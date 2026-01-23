import { error, info, success, warn } from 'signale';
import signale from 'signale';
import { TransactionReceipt } from 'ethers';
import { CHAIN_ID, transferHolder as transferHolderImpl } from '@trustvc/trustvc';
import { TitleEscrowTransferHolderCommand } from '../../types';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptRemark,
  promptWalletSelection,
  TransactionReceiptFees,
  getSupportedNetwork,
  getWalletOrSigner,
  canEstimateGasPrice,
  getGasFees,
  extractDocumentInfo,
  promptAndReadDocument,
  promptAddress,
  performDryRunWithConfirmation,
} from '../../utils';
import { connectToTitleEscrow, validateAndEncryptRemark } from '../helpers';

export const command = 'transfer-holder';

export const describe = 'Transfers the holder of the transferable record to another address';

export const handler = async (): Promise<string | undefined> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await changeHolderHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<TitleEscrowTransferHolderCommand> => {
  // Extract document information using utility function
  const document = await promptAndReadDocument();

  // Extract document information using utility function
  const { tokenRegistry, tokenId, network, documentId, registryVersion } =
    await extractDocumentInfo(document);

  // New Holder Address
  const newHolder = await promptAddress('new holder', 'new holder');

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
    newHolder,
    remark,
    encryptionKey,
    maxPriorityFeePerGasScale: 1,
  };

  // Add wallet-specific properties
  if (encryptedWalletPath) {
    return {
      ...baseResult,
      encryptedWalletPath,
    } as TitleEscrowTransferHolderCommand;
  } else if (keyFile) {
    return {
      ...baseResult,
      keyFile,
    } as TitleEscrowTransferHolderCommand;
  } else if (key) {
    return {
      ...baseResult,
      key,
    } as TitleEscrowTransferHolderCommand;
  }

  // For environment variable case (when all wallet options are undefined)
  return baseResult as TitleEscrowTransferHolderCommand;
};

// Change the holder with the provided inputs
export const changeHolderHandler = async (args: TitleEscrowTransferHolderCommand) => {
  try {
    info(
      `Connecting to the registry ${args.tokenRegistryAddress} and attempting to change the holder of the transferable record ${args.tokenId} to ${args.newHolder}`,
    );
    warn(
      `Please note that only current holders can change the holder of the transferable record, otherwise this command will fail.`,
    );

    const transaction = await transferHolder(args);
    const network = args.network as NetworkCmdName;

    displayTransactionPrice(transaction as unknown as TransactionReceiptFees, network);
    const { hash: transactionHash } = transaction;

    success(
      `Transferable record with hash ${args.tokenId}'s holder has been successfully changed to holder with address: ${args.newHolder}`,
    );
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transactionHash}`,
    );

    return args.tokenRegistryAddress;
  } catch (e) {
    error(getErrorMessage(e));
  }
};

/**
 * Transfers the holder role to a new address.
 * The holder has custody of the transferable record but not ownership.
 *
 * @param tokenRegistryAddress - The address of the token registry contract
 * @param newHolder - The address of the new holder (aliased as 'to')
 * @param remark - Optional remark/comment to attach to the transaction
 * @param encryptionKey - Optional encryption key for encrypting the remark
 * @param tokenId - The unique identifier of the token
 * @param network - The blockchain network to execute the transaction on
 * @param rest - Additional parameters (e.g., wallet configuration, gas settings)
 * @returns Promise resolving to the transaction receipt
 * @throws Error if provider is required but not available, or if transaction receipt is null
 */
export const transferHolder = async ({
  tokenRegistryAddress,
  newHolder: to,
  remark,
  encryptionKey,
  tokenId,
  network,
  ...rest
}: TitleEscrowTransferHolderCommand): Promise<TransactionReceipt> => {
  // Initialize wallet/signer for the transaction
  const wallet = await getWalletOrSigner({ network, ...rest });

  // Get the network ID for the specified network
  const networkId = getSupportedNetwork(network).networkId;

  // Automatic dry run for Ethereum and Polygon networks
  const shouldProceed = await performDryRunWithConfirmation({
    network,
    getTransactionCallback: async () => {
      const titleEscrow = await connectToTitleEscrow({
        tokenId,
        address: tokenRegistryAddress,
        wallet,
      });

      // Validate and encrypt the remark with document ID as encryption key
      const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);

      // Populate the transaction for gas estimation
      const tx = await titleEscrow.transferHolder.populateTransaction(to, encryptedRemark);

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

    // Execute holder transfer with EIP-1559 gas parameters
    transaction = await transferHolderImpl(
      { tokenRegistryAddress, tokenId },
      wallet,
      { remarks: remark, holderAddress: to },
      {
        chainId: networkId as unknown as CHAIN_ID,
        maxFeePerGas: gasFees.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
        id: encryptionKey,
      },
    );
  } else {
    // Execute holder transfer without gas estimation (for networks that don't support it)
    transaction = await transferHolderImpl(
      { tokenRegistryAddress, tokenId },
      wallet,
      { remarks: remark, holderAddress: to },
      {
        chainId: networkId as unknown as CHAIN_ID,
        id: encryptionKey,
      },
    );
  }
  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  const receipt = (await transaction.wait()) as unknown as TransactionReceipt;
  if (!receipt) {
    throw new Error('Transaction receipt not found');
  }
  return receipt;
};
