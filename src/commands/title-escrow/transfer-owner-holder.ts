import { error, info, success, warn } from 'signale';
import signale from 'signale';
import { TransactionReceipt } from 'ethers';
import { CHAIN_ID, transferOwners as transferOwnersImpl } from '@trustvc/trustvc';
import { TitleEscrowEndorseTransferOfOwnersCommand } from '../../types';
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
import {
  connectToTitleEscrow,
  validateAndEncryptRemark,
  validateEndorseChangeOwner,
} from '../helpers';

export const command = 'transfer-owner-holder';

export const describe =
  'Endorses the change of ownership and holdership of transferable record to another address';

export const handler = async (): Promise<string | undefined> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await endorseChangeOwnerHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<TitleEscrowEndorseTransferOfOwnersCommand> => {
  // Extract document information using utility function
  const document = await promptAndReadDocument();

  // Extract document information using utility function
  const { tokenRegistry, tokenId, network, documentId, registryVersion } =
    await extractDocumentInfo(document);

  // New Owner Address
  const newOwner = await promptAddress('new owner', 'new beneficiary');

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
    newOwner,
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
    } as TitleEscrowEndorseTransferOfOwnersCommand;
  } else if (keyFile) {
    return {
      ...baseResult,
      keyFile,
    } as TitleEscrowEndorseTransferOfOwnersCommand;
  } else if (key) {
    return {
      ...baseResult,
      key,
    } as TitleEscrowEndorseTransferOfOwnersCommand;
  }

  // For environment variable case (when all wallet options are undefined)
  return baseResult as TitleEscrowEndorseTransferOfOwnersCommand;
};

// Endorse the change of owner with the provided inputs
export const endorseChangeOwnerHandler = async (
  args: TitleEscrowEndorseTransferOfOwnersCommand,
) => {
  try {
    info(
      `Connecting to the registry ${args.tokenRegistryAddress} and attempting to endorse the change of owner of the transferable record ${args.tokenId} to new owner at ${args.newOwner} and new holder at ${args.newHolder}`,
    );
    warn(
      `Please note that you have to be both the holder and owner of the transferable record, otherwise this command will fail.`,
    );

    const transaction = await transferOwners(args);
    const network = args.network as NetworkCmdName;

    displayTransactionPrice(transaction as unknown as TransactionReceiptFees, network);
    const { hash: transactionHash } = transaction;

    success(
      `Transferable record with hash ${args.tokenId}'s holder has been successfully endorsed to new owner with address ${args.newOwner} and new holder with address: ${args.newHolder}`,
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
 * Transfers both the beneficiary (owner) and holder roles to new addresses.
 * This performs a complete transfer of ownership and custody in a single transaction.
 *
 * @param tokenRegistryAddress - The address of the token registry contract
 * @param tokenId - The unique identifier of the token
 * @param newHolder - The address of the new holder
 * @param newOwner - The address of the new beneficiary (owner)
 * @param remark - Optional remark/comment to attach to the transaction
 * @param encryptionKey - Optional encryption key for encrypting the remark
 * @param network - The blockchain network to execute the transaction on
 * @param rest - Additional parameters (e.g., wallet configuration, gas settings)
 * @returns Promise resolving to the transaction receipt
 * @throws Error if provider is required but not available, or if transaction receipt is not found
 */
export const transferOwners = async ({
  tokenRegistryAddress,
  tokenId,
  newHolder,
  newOwner,
  remark,
  encryptionKey,
  network,
  ...rest
}: TitleEscrowEndorseTransferOfOwnersCommand): Promise<TransactionReceipt> => {
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

      // Validate that the new owner and holder are different from current ones
      await validateEndorseChangeOwner({ newHolder, newOwner, titleEscrow });

      // Validate and encrypt the remark with document ID as encryption key
      const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);

      // Populate the transaction for gas estimation
      const tx = await titleEscrow.transferOwners.populateTransaction(
        newOwner,
        newHolder,
        encryptedRemark,
      );

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

    // Execute transfer owners with EIP-1559 gas parameters
    transaction = await transferOwnersImpl(
      { tokenRegistryAddress, tokenId },
      wallet,
      { remarks: remark, newBeneficiaryAddress: newOwner, newHolderAddress: newHolder },
      {
        chainId: networkId as unknown as CHAIN_ID,
        maxFeePerGas: gasFees.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
        id: encryptionKey,
      },
    );
  } else {
    // Execute transfer owners without gas estimation (for networks that don't support it)
    transaction = await transferOwnersImpl(
      { tokenRegistryAddress, tokenId },
      wallet,
      { remarks: remark, newBeneficiaryAddress: newOwner, newHolderAddress: newHolder },
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
