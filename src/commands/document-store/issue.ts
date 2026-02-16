import signale, { error, info, success } from 'signale';
import { DocumentStoreIssueCommand } from '../../types';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptWalletSelection,
  getWalletOrSigner,
  canEstimateGasPrice,
  getGasFees,
  promptAndReadDocument,
  performDryRunWithConfirmation,
  extractOADocumentInfo,
} from '../../utils';
import { connectToDocumentStore, waitForTransaction } from '../helpers';
import { documentStoreIssue } from '@trustvc/trustvc';
import { Provider } from 'ethers';

export const command = 'issue';

export const describe = 'Issues a hash to a document store deployed on the blockchain';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await issueToken(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<DocumentStoreIssueCommand> => {
  // Extract document information using utility function
  const document = await promptAndReadDocument();

  const { documentStoreAddress, tokenId, network } = await extractOADocumentInfo(document);

  // Wallet selection
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

  // Build the result object with proper typing
  const baseResult = {
    documentStoreAddress,
    documentHash: tokenId,
    network,
    maxPriorityFeePerGasScale: 1,
  };

  // Add wallet-specific properties based on selected wallet type
  if (encryptedWalletPath) {
    return {
      ...baseResult,
      encryptedWalletPath,
    } as DocumentStoreIssueCommand;
  } else if (keyFile) {
    return {
      ...baseResult,
      keyFile,
    } as DocumentStoreIssueCommand;
  } else if (key) {
    return {
      ...baseResult,
      key,
    } as DocumentStoreIssueCommand;
  }

  // For environment variable case (when all wallet options are undefined)
  return baseResult as DocumentStoreIssueCommand;
};

// Mint the token with the provided inputs
export const issueToken = async ({
  documentStoreAddress,
  documentHash,
  network,
  ...rest
}: DocumentStoreIssueCommand) => {
  try {
    info(`Issuing ${documentHash} to the document store ${documentStoreAddress}`);

    const wallet = await getWalletOrSigner({ network, ...rest });

    // Automatic dry run for Ethereum and Polygon networks
    const shouldProceed = await performDryRunWithConfirmation({
      network,
      getTransactionCallback: async () => {
        const documentStore = await connectToDocumentStore({
          address: documentStoreAddress,
          wallet,
        });
        // Populate the transaction for gas estimation
        const tx = await documentStore.issue.populateTransaction(documentHash);

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
      // Execute mint with EIP-1559 gas parameters
      transaction = await documentStoreIssue(documentStoreAddress, documentHash, wallet, {
        maxFeePerGas: gasFees.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
      });
    } else {
      // Execute mint without gas estimation (for networks that don't support it)
      transaction = await documentStoreIssue(documentStoreAddress, documentHash, wallet);
    }
    const receipt = await waitForTransaction(transaction, wallet.provider as Provider);

    signale.await(`Waiting for transaction ${transaction.hash} to be mined`);

    displayTransactionPrice(receipt, network as NetworkCmdName);
    const { hash: transactionHash } = transaction;

    success(`Token with hash ${documentHash} has been issued on ${documentStoreAddress}`);
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${transactionHash}`);

    return documentStoreAddress;
  } catch (e) {
    error(getErrorMessage(e));
  }
};
