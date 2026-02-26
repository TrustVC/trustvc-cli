import signale, { error, info, success } from 'signale';
import { select } from '@inquirer/prompts';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptWalletSelection,
  getWalletOrSigner,
  canEstimateGasPrice,
  getGasFees,
  performDryRunWithConfirmation,
  promptAddress,
  promptAndReadDocument,
  extractOADocumentInfo,
  NetworkAndWalletSignerOption,
  GasPriceScale,
} from '../../utils';
import { connectToDocumentStore, waitForTransaction } from '../helpers';
import { documentStoreGrantRole } from '@trustvc/trustvc';
import { Provider, id as keccak256Hash } from 'ethers';

// Define the command type for grant-role
type DocumentStoreGrantRoleCommand = NetworkAndWalletSignerOption &
  GasPriceScale & {
    documentStoreAddress: string;
    role: string;
    account: string;
  };

export const command = 'grant-role';

export const describe = 'Grants a role to a document store deployed on the blockchain';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await grantRoleToDocumentStore(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<DocumentStoreGrantRoleCommand> => {
  // Extract document information using utility function
  const document = await promptAndReadDocument();

  const { documentStoreAddress, network } = await extractOADocumentInfo(document);

  // Role selection
  const role = await select({
    message: 'Select the role to grant:',
    choices: [
      {
        name: 'Issuer Role',
        value: 'ISSUER_ROLE',
        description: 'Allows the account to issue documents',
      },
      {
        name: 'Revoker Role',
        value: 'REVOKER_ROLE',
        description: 'Allows the account to revoke documents',
      },
      {
        name: 'Default Admin Role',
        value: 'DEFAULT_ADMIN_ROLE',
        description: 'Allows the account to manage roles',
      },
    ],
    default: 'ISSUER_ROLE',
  });

  // Account address to grant the role to
  const account = (await promptAddress('account', 'address to grant the role to')) as string;

  // Wallet selection
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

  // Build the result object with proper typing
  const baseResult = {
    documentStoreAddress,
    role, // This will be converted to role hash in the execution function
    account,
    network,
    maxPriorityFeePerGasScale: 1,
  };

  // Add wallet-specific properties based on selected wallet type
  if (encryptedWalletPath) {
    return {
      ...baseResult,
      encryptedWalletPath,
    } as DocumentStoreGrantRoleCommand;
  } else if (keyFile) {
    return {
      ...baseResult,
      keyFile,
    } as DocumentStoreGrantRoleCommand;
  } else if (key) {
    return {
      ...baseResult,
      key,
    } as DocumentStoreGrantRoleCommand;
  }

  // For environment variable case (when all wallet options are undefined)
  return baseResult as DocumentStoreGrantRoleCommand;
};

// Grant role to document store with the provided inputs
export const grantRoleToDocumentStore = async ({
  documentStoreAddress,
  role,
  account,
  network,
  ...rest
}: DocumentStoreGrantRoleCommand) => {
  try {
    info(`Granting ${role} to ${account} on document store ${documentStoreAddress}`);

    const wallet = await getWalletOrSigner({ network, ...rest });

    // Get the role hash from the role name using keccak256
    // For AccessControl contracts, roles are stored as keccak256 hashes
    // DEFAULT_ADMIN_ROLE is 0x00...00, others are keccak256("ROLE_NAME")
    const roleHash =
      role === 'DEFAULT_ADMIN_ROLE'
        ? '0x0000000000000000000000000000000000000000000000000000000000000000'
        : keccak256Hash(role);

    // Automatic dry run for Ethereum and Polygon networks
    const shouldProceed = await performDryRunWithConfirmation({
      network,
      getTransactionCallback: async () => {
        const documentStore = await connectToDocumentStore({
          address: documentStoreAddress,
          wallet,
        });
        // Populate the transaction for gas estimation
        const tx = await documentStore.grantRole.populateTransaction(roleHash, account);

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

    let transaction;

    // Execute transaction with appropriate gas settings based on network capabilities
    if (canEstimateGasPrice(network)) {
      // Ensure provider is available for gas estimation
      if (!wallet.provider) {
        throw new Error('Provider is required for gas estimation');
      }

      // Get current gas fees from the network
      const gasFees = await getGasFees({ provider: wallet.provider, ...rest });
      // Execute grant role with EIP-1559 gas parameters
      transaction = await documentStoreGrantRole(documentStoreAddress, roleHash, account, wallet, {
        maxFeePerGas: gasFees.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
      });
    } else {
      // Execute grant role without gas estimation (for networks that don't support it)
      transaction = await documentStoreGrantRole(documentStoreAddress, roleHash, account, wallet);
    }

    signale.await(`Waiting for transaction ${transaction.hash} to be mined`);

    const receipt = await waitForTransaction(transaction, wallet.provider as Provider);

    displayTransactionPrice(receipt, network as NetworkCmdName);
    const { hash: transactionHash } = transaction;

    success(`Role ${role} has been granted to ${account} on ${documentStoreAddress}`);
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${transactionHash}`);

    return documentStoreAddress;
  } catch (e) {
    error(getErrorMessage(e));
  }
};
