import { error, info, success } from 'signale';
import { CHAIN_ID, deployObligationRegistry } from '@trustvc/trustvc';
import { input, confirm } from '@inquirer/prompts';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptWalletSelection,
  promptNetworkSelection,
  getWalletOrSigner,
  getSupportedNetwork,
  performDryRunWithConfirmation,
  promptAddress,
  supportedNetwork,
} from '../../utils';
import { TransactionReceipt } from 'ethers';

export const command = 'deploy';

export const describe = 'Deploys an Obligation Registry (TrustVCToken + ObligationEscrowFactory)';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await deployObligationRegistryContract(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

type DeployObligationRegistryCommand = {
  registryName: string;
  registrySymbol: string;
  escrowFactoryAddress?: string;
  network: string;
  encryptedWalletPath?: string;
  key?: string;
  keyFile?: string;
  maxPriorityFeePerGasScale: number;
};

export const promptForInputs = async (): Promise<DeployObligationRegistryCommand> => {
  const network = await promptNetworkSelection();

  const registryName = await input({
    message: 'Enter the name of the obligation registry:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Registry name is required';
      }
      return true;
    },
  });

  const registrySymbol = await input({
    message: 'Enter the symbol of the obligation registry:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Registry symbol is required';
      }
      return true;
    },
  });

  const reuseFactory = await confirm({
    message: 'Reuse an existing ObligationEscrowFactory address?',
    default: false,
  });

  const escrowFactoryAddress = reuseFactory
    ? await promptAddress('ObligationEscrowFactory', 'optional', true)
    : undefined;

  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

  const baseResult = {
    network,
    registryName,
    registrySymbol,
    escrowFactoryAddress,
    maxPriorityFeePerGasScale: 1,
  };

  if (encryptedWalletPath) {
    return { ...baseResult, encryptedWalletPath } as DeployObligationRegistryCommand;
  }
  if (keyFile) {
    return { ...baseResult, keyFile } as DeployObligationRegistryCommand;
  }
  if (key) {
    return { ...baseResult, key } as DeployObligationRegistryCommand;
  }
  return baseResult as DeployObligationRegistryCommand;
};

export const deployObligationRegistryContract = async ({
  network,
  registryName,
  registrySymbol,
  escrowFactoryAddress,
  ...rest
}: DeployObligationRegistryCommand) => {
  try {
    const wallet = await getWalletOrSigner({ network, ...rest });
    const chainId = supportedNetwork[network as NetworkCmdName].networkId;

    const shouldProceed = await performDryRunWithConfirmation({
      network,
      getTransactionCallback: async () => ({
        to: await wallet.getAddress(),
        data: '0x',
        from: await wallet.getAddress(),
        value: 0n,
      }),
    });

    if (!shouldProceed) {
      process.exit(0);
    }

    info(`Deploying obligation registry ${registryName}`);

    const result = await deployObligationRegistry(registryName, registrySymbol, wallet, {
      chainId: getSupportedNetwork(network).networkId as unknown as CHAIN_ID,
      escrowFactoryAddress,
    });

    displayTransactionPrice(result.receipt as any, network as NetworkCmdName);

    const { hash } = result.receipt as unknown as TransactionReceipt;
    success(`Obligation registry ${registryName} deployed at ${result.obligationRegistry}`);
    info(`ObligationEscrowFactory: ${result.obligationEscrowFactoryAddress}`);
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${hash}`);
    info(`Chain ID used: ${chainId}`);

    return result.obligationRegistry;
  } catch (e) {
    error(getErrorMessage(e));
  }
};
