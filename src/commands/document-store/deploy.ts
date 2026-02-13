import { error, info, success } from 'signale';
import { CHAIN_ID, deployDocumentStore } from '@trustvc/trustvc';
import { input } from '@inquirer/prompts';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptWalletSelection,
  promptNetworkSelection,
  getWalletOrSigner,
  TransactionReceiptFees,
  getSupportedNetwork,
  performDryRunWithConfirmation,
} from '../../utils';
import { connectToDocumentStore, connectToDocumentStoreFactory } from '../helpers';
import { TransactionReceipt } from 'ethers';

export const command = 'deploy';

export const describe = 'Deploys a document store contract on the blockchain';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await deployDocumentStoreContract(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Define the command type
type DeployDocumentStoreCommand = {
  network: string;
  storeName: string;
  owner: string;
  encryptedWalletPath?: string;
  key?: string;
  keyFile?: string;
  maxPriorityFeePerGasScale: number;
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<DeployDocumentStoreCommand> => {
  // Store name
  const storeName = await input({
    message: 'Enter the name of the document store:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Store name is required';
      }
      return true;
    },
  });

  // Network selection
  const network = await promptNetworkSelection();

  // Owner address (optional)
  const ownerInput = await input({
    message: 'Enter the owner address (optional, press Enter to use deployer address):',
    required: false,
    validate: (value: string) => {
      if (value && value.trim() !== '' && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
        return 'Invalid Ethereum address format';
      }
      return true;
    },
  });

  const owner = ownerInput && ownerInput.trim() !== '' ? ownerInput : undefined;

  // Wallet selection
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

  // Build the result object with proper typing
  const baseResult = {
    network,
    storeName,
    owner,
    maxPriorityFeePerGasScale: 1,
  };

  // Add wallet-specific properties based on selected wallet type
  if (encryptedWalletPath) {
    return {
      ...baseResult,
      encryptedWalletPath,
    } as DeployDocumentStoreCommand;
  } else if (keyFile) {
    return {
      ...baseResult,
      keyFile,
    } as DeployDocumentStoreCommand;
  } else if (key) {
    return {
      ...baseResult,
      key,
    } as DeployDocumentStoreCommand;
  }

  // For environment variable case (when all wallet options are undefined)
  return baseResult as DeployDocumentStoreCommand;
};

// Deploy the document store with the provided inputs
export const deployDocumentStoreContract = async ({
  network,
  storeName,
  owner,
  ...rest
}: DeployDocumentStoreCommand) => {
  try {
    const wallet = await getWalletOrSigner({ network, ...rest });
    owner = owner === undefined ? await wallet.getAddress() : owner;
    // Automatic dry run for Ethereum and Polygon networks
    const shouldProceed = await performDryRunWithConfirmation({
      network,
      getTransactionCallback: async () => {
        const documentStoreFactory = await connectToDocumentStoreFactory();

        // Populate the transaction for gas estimation
        const tx = await documentStoreFactory.getDeployTransaction(storeName, owner);

        // Ensure the transaction has a 'from' address for proper gas estimation
        return {
          ...tx,
          from: await wallet.getAddress(),
        };
      },
    });

    if (!shouldProceed) {
      process.exit(0);
    }

    info(`Deploying document store ${storeName}`);

    const transaction = await deployDocumentStore(storeName, owner, wallet, {
      chainId: getSupportedNetwork(network).networkId as unknown as CHAIN_ID,
    });

    displayTransactionPrice(
      transaction as unknown as TransactionReceiptFees,
      network as NetworkCmdName,
    );

    const { hash, contractAddress } = transaction as unknown as TransactionReceipt;

    success(`Document store ${storeName} deployed at ${contractAddress}`);
    info(`Find more details at ${getEtherscanAddress({ network: network })}/tx/${hash}`);

    return contractAddress;
  } catch (e) {
    console.log(e);
    error(getErrorMessage(e));
  }
};
