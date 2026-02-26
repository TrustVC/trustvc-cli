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
import { documentStoreRevokeRole } from '@trustvc/trustvc';
import { Provider, id as keccak256Hash } from 'ethers';

// Define the command type for revoke-role
type DocumentStoreRevokeRoleCommand = NetworkAndWalletSignerOption &
  GasPriceScale & {
    documentStoreAddress: string;
    role: string;
    account: string;
  };

export const command = 'revoke-role';

export const describe = 'Revokes a role from a document store deployed on the blockchain';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await revokeRoleFromDocumentStore(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<DocumentStoreRevokeRoleCommand> => {
  // Extract document information using utility function
  const document = await promptAndReadDocument();

  const { documentStoreAddress, network } = await extractOADocumentInfo(document);

  // Role selection
  const role = await select({
    message: 'Select the role to revoke:',
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

  // Account address to revoke the role from
  const account = (await promptAddress('account', 'address to revoke the role from')) as string;

  // Wallet selection
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

  // Build the result object with proper typing
  const baseResult = {
    documentStoreAddress,
    role,
    account,
    network,
    maxPriorityFeePerGasScale: 1,
  };

  // Add wallet-specific properties based on selected wallet type
  if (encryptedWalletPath) {
    return {
      ...baseResult,
      encryptedWalletPath,
    } as DocumentStoreRevokeRoleCommand;
  } else if (keyFile) {
    return {
      ...baseResult,
      keyFile,
    } as DocumentStoreRevokeRoleCommand;
  } else if (key) {
    return {
      ...baseResult,
      key,
    } as DocumentStoreRevokeRoleCommand;
  }

  // For environment variable case (when all wallet options are undefined)
  return baseResult as DocumentStoreRevokeRoleCommand;
};

// Revoke role from document store with the provided inputs
export const revokeRoleFromDocumentStore = async ({
  documentStoreAddress,
  role,
  account,
  network,
  ...rest
}: DocumentStoreRevokeRoleCommand) => {
  try {
    info(`Revoking ${role} from ${account} on document store ${documentStoreAddress}`);

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
        const tx = await documentStore.revokeRole.populateTransaction(roleHash, account);

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
      // Execute revoke role with EIP-1559 gas parameters
      transaction = await documentStoreRevokeRole(documentStoreAddress, roleHash, account, wallet, {
        maxFeePerGas: gasFees.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
      });
    } else {
      // Execute revoke role without gas estimation (for networks that don't support it)
      transaction = await documentStoreRevokeRole(documentStoreAddress, roleHash, account, wallet);
    }

    signale.await(`Waiting for transaction ${transaction.hash} to be mined`);

    const receipt = await waitForTransaction(transaction, wallet.provider as Provider);

    displayTransactionPrice(receipt, network as NetworkCmdName);
    const { hash: transactionHash } = transaction;

    success(`Role ${role} has been revoked from ${account} on ${documentStoreAddress}`);
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${transactionHash}`);

    return documentStoreAddress;
  } catch (e) {
    error(getErrorMessage(e));
  }
};
