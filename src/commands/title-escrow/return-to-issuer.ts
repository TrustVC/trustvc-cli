import { error, success, info } from 'signale';
import signale from 'signale';
import { TransactionReceipt } from 'ethers';
import { CHAIN_ID, returnToIssuer as returnToIssuerImpl } from '@trustvc/trustvc';
import { BaseTitleEscrowCommand as TitleEscrowReturnDocumentCommand } from '../../types';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptWalletSelection,
  TransactionReceiptFees,
  getSupportedNetwork,
  getWalletOrSigner,
  canEstimateGasPrice,
  getGasFees,
  extractDocumentInfo,
  promptAndReadDocument,
  promptRemark,
  performDryRunWithConfirmation,
  verifyDocumentSignature,
} from '../../utils';
import { connectToTitleEscrow, validateAndEncryptRemark } from '../helpers';

export const command = 'return-to-issuer';

export const describe = 'Returns a document on the blockchain';

export const handler = async (): Promise<string | undefined> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await returnDocumentToIssuerHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<TitleEscrowReturnDocumentCommand> => {
  // Extract document information using utility function
  const document = await promptAndReadDocument();

  // Verify document signature before proceeding
  await verifyDocumentSignature(document);

  // Extract document information using utility function
  const { tokenRegistry, tokenId, network, documentId, registryVersion } =
    await extractDocumentInfo(document);

  // Wallet selection
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

  // Optional: Remark (only for V5)
  const remark = await promptRemark(registryVersion);

  // Use document ID as encryption key
  const encryptionKey = documentId;

  // Build the result object
  const baseResult = {
    network,
    tokenRegistryAddress: tokenRegistry,
    tokenId,
    remark,
    encryptionKey,
    maxPriorityFeePerGasScale: 1,
  };

  // Add wallet-specific properties
  if (encryptedWalletPath) {
    return {
      ...baseResult,
      encryptedWalletPath,
    } as TitleEscrowReturnDocumentCommand;
  } else if (keyFile) {
    return {
      ...baseResult,
      keyFile,
    } as TitleEscrowReturnDocumentCommand;
  } else if (key) {
    return {
      ...baseResult,
      key,
    } as TitleEscrowReturnDocumentCommand;
  }

  // For environment variable case (when all wallet options are undefined)
  return baseResult as TitleEscrowReturnDocumentCommand;
};

// Return the document with the provided inputs
export const returnDocumentToIssuerHandler = async (args: TitleEscrowReturnDocumentCommand) => {
  try {
    info(`Returning document with hash ${args.tokenId}`);

    const transaction = await returnDocument(args);

    const network = args.network as NetworkCmdName;
    displayTransactionPrice(transaction as unknown as TransactionReceiptFees, network);
    const { hash: transactionHash } = transaction;

    success(`Transferable record with hash ${args.tokenId} has been returned.`);
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transactionHash}`,
    );

    return args.tokenRegistryAddress;
  } catch (e) {
    error(getErrorMessage(e));
  }
};

/**
 * Returns a transferable record to the issuer.
 * This operation surrenders the document back to the issuer for acceptance or rejection.
 *
 * @param remark - Optional remark/comment to attach to the transaction
 * @param encryptionKey - Optional encryption key for encrypting the remark
 * @param tokenRegistryAddress - The address of the token registry contract
 * @param tokenId - The unique identifier of the token to return
 * @param network - The blockchain network to execute the transaction on
 * @param rest - Additional parameters (e.g., wallet configuration, gas settings)
 * @returns Promise resolving to the transaction receipt
 * @throws Error if provider is required but not available, or if transaction receipt is null
 */
export const returnDocument = async ({
  remark,
  encryptionKey,
  tokenRegistryAddress,
  tokenId,
  network,
  ...rest
}: TitleEscrowReturnDocumentCommand): Promise<TransactionReceipt> => {
  // Initialize wallet/signer for the transaction
  const wallet = await getWalletOrSigner({ network, ...rest });

  // Get the network ID for the specified network
  const networkId = getSupportedNetwork(network).networkId;

  // Automatic dry run for Ethereum and Polygon networks
  const shouldProceed = await performDryRunWithConfirmation({
    network,
    getTransactionCallback: async () => {
      // Connect to the title escrow contract for this token
      const titleEscrow = await connectToTitleEscrow({
        tokenId,
        address: tokenRegistryAddress,
        wallet,
      });

      // Validate and encrypt the remark if encryption key is provided
      const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);

      // Populate the transaction for gas estimation
      const tx = await titleEscrow.returnToIssuer.populateTransaction(encryptedRemark);

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

    // Execute return to issuer with EIP-1559 gas parameters
    transaction = await returnToIssuerImpl(
      { tokenRegistryAddress, tokenId },
      wallet,
      { remarks: remark },
      {
        chainId: networkId as unknown as CHAIN_ID,
        maxFeePerGas: gasFees.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
        id: encryptionKey,
      },
    );
  } else {
    // Execute return to issuer without gas estimation (for networks that don't support it)
    transaction = await returnToIssuerImpl(
      { tokenRegistryAddress, tokenId },
      wallet,
      { remarks: remark },
      {
        chainId: networkId as unknown as CHAIN_ID,
        id: encryptionKey,
      },
    );
  }

  // Wait for transaction to be mined
  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  const receipt = await transaction.wait();

  // Validate receipt exists
  if (!receipt) {
    throw new Error('Transaction receipt is null');
  }

  return receipt as unknown as TransactionReceipt;
};
