import { error, info, success, warn } from 'signale';
import { input } from '@inquirer/prompts';
import { createPublicClient, http, parseEventLogs } from 'viem';
import { deployTokenRegistryGasless, eip7702Abis, v5ContractAddress } from '@trustvc/trustvc';
import {
  getErrorMessage,
  getEtherscanAddress,
  getWalletOrSigner,
  promptAddress,
  promptNetworkSelection,
  promptWalletSelection,
} from '../../../utils';
import {
  assertGaslessSupportedNetwork,
  getGaslessRpcUrl,
  getViemChain,
  redactPimlicoApiKey,
} from '../config';
import { buildGaslessSmartAccountClient } from '../client';
import { checkGaslessDeployEligibility } from '../eligibility';
import { GaslessWalletOption } from '../types';

// Deploys a new token registry gaslessly via the PlatformPaymaster's deployRegistry(). Wired into
// `token-registry deploy --gasless` (see ../../token-registry/deploy.ts) rather than being its
// own top-level command, matching every other gasless action.
export type DeployTokenRegistryGaslessCommand = GaslessWalletOption & {
  network: string;
  registryName: string;
  registrySymbol: string;
  paymasterAddress: string;
  tokenRegistryImplAddress: string;
};

export const promptForDeployTokenRegistryGaslessInputs =
  async (): Promise<DeployTokenRegistryGaslessCommand> => {
    const network = await promptNetworkSelection();
    const assertedNetwork = assertGaslessSupportedNetwork(network);

    const registryName = await input({
      message: 'Enter the name of the token registry:',
      required: true,
      validate: (value: string) => (value.trim() === '' ? 'Registry name is required' : true),
    });

    const registrySymbol = await input({
      message: 'Enter the symbol of the token registry:',
      required: true,
      validate: (value: string) => (value.trim() === '' ? 'Registry symbol is required' : true),
    });

    const paymasterAddress = await promptAddress(
      'paymaster',
      'PlatformPaymaster contract that will sponsor this deployment',
    );

    const chainId = getViemChain(assertedNetwork).id;
    const defaultImplAddress = v5ContractAddress.TokenImplementation[chainId];
    const tokenRegistryImplAddress = await promptAddress(
      'token registry implementation',
      defaultImplAddress
        ? `optional — defaults to ${defaultImplAddress} for this network`
        : 'the deployed TradeTrustToken implementation contract to clone',
      Boolean(defaultImplAddress),
    );

    const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

    return {
      network,
      registryName,
      registrySymbol,
      paymasterAddress: paymasterAddress as string,
      tokenRegistryImplAddress: (tokenRegistryImplAddress ?? defaultImplAddress) as string,
      encryptedWalletPath,
      key,
      keyFile,
    };
  };

export const runDeployTokenRegistryGasless = async (
  args: DeployTokenRegistryGaslessCommand,
): Promise<string | undefined> => {
  try {
    const network = assertGaslessSupportedNetwork(args.network);

    // This wallet is only used to recover the raw private key for the smart-account owner; no
    // transaction is ever signed or sent with it directly.
    const wallet = await getWalletOrSigner({
      network,
      encryptedWalletPath: args.encryptedWalletPath,
      key: args.key,
      keyFile: args.keyFile,
    });

    const privateKey = (wallet as { privateKey?: string }).privateKey;
    if (!privateKey) {
      throw new Error(
        'Gasless transactions require direct access to a private key (encrypted wallet file, --key, --key-file, or OA_PRIVATE_KEY). AWS KMS signers are not supported.',
      );
    }

    const callerAddress = await wallet.getAddress();

    warn('Checking whether this account is eligible to deploy gaslessly...');
    await checkGaslessDeployEligibility({
      network,
      paymasterAddress: args.paymasterAddress as `0x${string}`,
      callerAddress: callerAddress as `0x${string}`,
    });
    success('Account is eligible to deploy gaslessly');

    const { smartAccountClient } = await buildGaslessSmartAccountClient({
      network,
      privateKey,
      paymasterAddress: args.paymasterAddress as `0x${string}`,
    });

    info(
      `Submitting gasless deployment of token registry ${args.registryName} (${args.registrySymbol}). Gas is sponsored by the PlatformPaymaster — no ETH is required from your wallet.`,
    );

    const transactionHash = await deployTokenRegistryGasless(
      args.registryName,
      args.registrySymbol,
      smartAccountClient,
      {
        paymasterAddress: args.paymasterAddress as `0x${string}`,
        tokenRegistryImplAddress: args.tokenRegistryImplAddress as `0x${string}`,
      },
    );

    const publicClient = createPublicClient({
      chain: getViemChain(network),
      transport: http(getGaslessRpcUrl(network)),
    });
    const receipt = await publicClient.getTransactionReceipt({ hash: transactionHash });
    const [deployedEvent] = parseEventLogs({
      abi: eip7702Abis.platformPaymasterAbi,
      logs: receipt.logs,
      eventName: 'RegistryDeployed',
    });
    const deployedAddress = deployedEvent?.args?.deployed;

    if (deployedAddress) {
      success(`Token registry ${args.registryName} deployed at ${deployedAddress}`);
    } else {
      success(`Token registry ${args.registryName} deployment submitted`);
    }
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${transactionHash}`);

    return deployedAddress ?? transactionHash;
  } catch (e) {
    error(redactPimlicoApiKey(getErrorMessage(e)));
  }
};
