import { Argv } from 'yargs';
import { error, info, success } from 'signale';
import { input } from '@inquirer/prompts';
import { id } from 'ethers';
import { deployPlatformPaymaster } from '@trustvc/trustvc';
import {
  getErrorMessage,
  getEtherscanAddress,
  getSupportedNetwork,
  getWalletOrSigner,
  promptAddress,
  promptNetworkSelection,
  promptWalletSelection,
} from '../../../utils';
import { assertGaslessSupportedNetwork, getGaslessFactoryAddress } from '../config';
import { GaslessWalletOption } from '../types';

// Deploys the PlatformPaymaster itself — this is a regular, non-gasless transaction. Someone has
// to pay real gas to bootstrap the paymaster before it can sponsor anything else.
export const command = 'deploy-platform-paymaster';

export const describe =
  'Deploys a PlatformPaymaster contract that sponsors gasless title-escrow and token-registry transactions. This is a regular transaction — you pay gas directly to deploy it.';

export const builder = (yargs: Argv): Argv => yargs;

export type DeployPlatformPaymasterCommand = GaslessWalletOption & {
  network: string;
  salt: string;
  platformAddress?: string;
  dailyLimit?: string;
};

export const promptForDeployPlatformPaymasterInputs =
  async (): Promise<DeployPlatformPaymasterCommand> => {
    const network = await promptNetworkSelection();
    assertGaslessSupportedNetwork(network);

    const saltInput = await input({
      message:
        'Enter a salt to deterministically derive the paymaster address (0x-prefixed 32-byte hex, or any string — it will be hashed into one):',
      required: true,
      validate: (value: string) => {
        if (value.startsWith('0x') && !/^0x[a-fA-F0-9]{64}$/.test(value)) {
          return 'A 0x-prefixed salt must be a 32-byte (64 hex character) value';
        }
        return true;
      },
    });

    // A 0x-prefixed value is used as-is (already validated above); anything else is hashed into
    // a deterministic bytes32 value.
    const salt = saltInput.startsWith('0x') ? saltInput : id(saltInput);

    const platformAddress = await promptAddress(
      'platform owner',
      'defaults to your own deployer address if left blank',
      true,
    );

    const dailyLimit = await input({
      message: 'Enter the daily sponsored-gas limit in wei (optional, 0 = unlimited):',
      required: false,
      default: '0',
      validate: (value: string) => {
        if (value && !/^\d+$/.test(value)) {
          return 'Daily limit must be a non-negative integer (wei)';
        }
        return true;
      },
    });

    const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

    return {
      network,
      salt,
      platformAddress,
      dailyLimit: dailyLimit || undefined,
      encryptedWalletPath,
      key,
      keyFile,
    };
  };

export const runDeployPlatformPaymaster = async (
  args: DeployPlatformPaymasterCommand,
): Promise<string | undefined> => {
  try {
    const network = assertGaslessSupportedNetwork(args.network);

    const wallet = await getWalletOrSigner({
      network,
      encryptedWalletPath: args.encryptedWalletPath,
      key: args.key,
      keyFile: args.keyFile,
    });

    info(`Deploying PlatformPaymaster on ${network}...`);

    const { txHash, paymasterAddress } = await deployPlatformPaymaster(wallet, {
      chainId: getSupportedNetwork(network).networkId,
      salt: args.salt as `0x${string}`,
      platformAddress: args.platformAddress as `0x${string}` | undefined,
      factoryAddress: getGaslessFactoryAddress(network),
      dailyLimit: args.dailyLimit ? BigInt(args.dailyLimit) : undefined,
    });

    success(`PlatformPaymaster deployed at ${paymasterAddress}`);
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${txHash}`);

    return paymasterAddress;
  } catch (e) {
    error(getErrorMessage(e));
  }
};

export const handler = async (): Promise<string | undefined> => {
  try {
    const answers = await promptForDeployPlatformPaymasterInputs();
    return await runDeployPlatformPaymaster(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
