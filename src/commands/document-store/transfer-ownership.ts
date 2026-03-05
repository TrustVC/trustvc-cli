import signale, { error, info, success } from 'signale';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptWalletSelection,
  getWalletOrSigner,
  canEstimateGasPrice,
  getGasFees,
  promptAddress,
  promptAndReadDocument,
  extractOADocumentInfo,
  NetworkAndWalletSignerOption,
  GasPriceScale,
  verifyDocumentSignature,
} from '../../utils';
import { waitForTransaction } from '../helpers';
import { documentStoreTransferOwnership } from '@trustvc/trustvc';
import { Provider } from 'ethers';

// Define the command type for transfer-ownership
type DocumentStoreTransferOwnershipCommand = NetworkAndWalletSignerOption &
  GasPriceScale & {
    documentStoreAddress: string;
    newOwner: string;
  };

export const command = 'transfer-ownership';

export const describe = 'Transfers ownership of a document store deployed on the blockchain';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await transferOwnershipOfDocumentStore(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<DocumentStoreTransferOwnershipCommand> => {
  // Extract document information using utility function
  const document = await promptAndReadDocument();

  await verifyDocumentSignature(document);

  const { documentStoreAddress, network } = await extractOADocumentInfo(document);

  // New owner address to transfer ownership to
  const newOwner = (await promptAddress('new owner', 'address to transfer ownership to')) as string;

  // Wallet selection
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

  // Build the result object with proper typing
  const baseResult = {
    documentStoreAddress,
    newOwner,
    network,
    maxPriorityFeePerGasScale: 1,
  };

  // Add wallet-specific properties based on selected wallet type
  if (encryptedWalletPath) {
    return {
      ...baseResult,
      encryptedWalletPath,
    } as DocumentStoreTransferOwnershipCommand;
  } else if (keyFile) {
    return {
      ...baseResult,
      keyFile,
    } as DocumentStoreTransferOwnershipCommand;
  } else if (key) {
    return {
      ...baseResult,
      key,
    } as DocumentStoreTransferOwnershipCommand;
  }

  // For environment variable case (when all wallet options are undefined)
  return baseResult as DocumentStoreTransferOwnershipCommand;
};

// Transfer ownership of document store with the provided inputs
export const transferOwnershipOfDocumentStore = async ({
  documentStoreAddress,
  newOwner,
  network,
  ...rest
}: DocumentStoreTransferOwnershipCommand) => {
  try {
    info(`Transferring ownership to ${newOwner} on document store ${documentStoreAddress}`);

    const wallet = await getWalletOrSigner({ network, ...rest });

    let grantTransaction;
    let revokeTransaction;

    // Execute transaction with appropriate gas settings based on network capabilities
    if (canEstimateGasPrice(network)) {
      // Ensure provider is available for gas estimation
      if (!wallet.provider) {
        throw new Error('Provider is required for gas estimation');
      }

      // Get current gas fees from the network
      const gasFees = await getGasFees({ provider: wallet.provider, ...rest });
      // Execute transfer ownership with EIP-1559 gas parameters
      ({ grantTransaction, revokeTransaction } = await documentStoreTransferOwnership(
        documentStoreAddress,
        newOwner,
        wallet,
        {
          maxFeePerGas: gasFees.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
        },
      ));
    } else {
      // Execute transfer ownership without gas estimation (for networks that don't support it)
      ({ grantTransaction, revokeTransaction } = await documentStoreTransferOwnership(
        documentStoreAddress,
        newOwner,
        wallet,
      ));
    }

    if (!grantTransaction || !revokeTransaction) {
      throw new Error('Grant or revoke transaction not found');
    }

    // Wait for both transactions to be mined
    signale.await(
      `Waiting for grant transaction ${grantTransaction.hash} and revoke transaction ${revokeTransaction.hash} to be mined`,
    );

    const grantReceipt = await waitForTransaction(grantTransaction, wallet.provider as Provider);
    const revokeReceipt = await waitForTransaction(revokeTransaction, wallet.provider as Provider);

    // Display transaction details for both transactions
    info('Grant transaction:');
    displayTransactionPrice(grantReceipt, network as NetworkCmdName);
    info(`Grant transaction hash: ${grantTransaction.hash}`);

    info('Revoke transaction:');
    displayTransactionPrice(revokeReceipt, network as NetworkCmdName);
    info(`Revoke transaction hash: ${revokeTransaction.hash}`);

    success(`Ownership has been transferred to ${newOwner} on ${documentStoreAddress}`);
    info(`Grant transaction: ${getEtherscanAddress({ network })}/tx/${grantTransaction.hash}`);
    info(`Revoke transaction: ${getEtherscanAddress({ network })}/tx/${revokeTransaction.hash}`);

    return documentStoreAddress;
  } catch (e) {
    error(getErrorMessage(e));
  }
};
