import { error, info, success, warn } from 'signale';
import signale from 'signale';
import { TransactionReceipt } from 'ethers';
import { CHAIN_ID, transferBeneficiary as transferBeneficiaryImpl } from '@trustvc/trustvc';
import { TitleEscrowNominateBeneficiaryCommand } from '../../types';
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
  validateNominateBeneficiary,
} from '../helpers';

export const command = 'endorse-transfer-owner';

export const describe =
  'Endorses the transfer of owner of transferable record to an approved owner and approved holder address';

export const handler = async (): Promise<string | undefined> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await endorseTransferOwnerHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<TitleEscrowNominateBeneficiaryCommand> => {
  // Extract document information using utility function
  const document = await promptAndReadDocument();

  // Extract document information using utility function
  const { tokenRegistry, tokenId, network, documentId, registryVersion } =
    await extractDocumentInfo(document);

  // New Beneficiary Address
  const newBeneficiary = await promptAddress('new beneficiary', 'new owner');

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
    newBeneficiary,
    remark,
    encryptionKey,
    maxPriorityFeePerGasScale: 1,
  };

  // Add wallet-specific properties
  if (encryptedWalletPath) {
    return {
      ...baseResult,
      encryptedWalletPath,
    } as TitleEscrowNominateBeneficiaryCommand;
  } else if (keyFile) {
    return {
      ...baseResult,
      keyFile,
    } as TitleEscrowNominateBeneficiaryCommand;
  } else if (key) {
    return {
      ...baseResult,
      key,
    } as TitleEscrowNominateBeneficiaryCommand;
  }

  // For environment variable case (when all wallet options are undefined)
  return baseResult as TitleEscrowNominateBeneficiaryCommand;
};

// Endorse the transfer of owner with the provided inputs
export const endorseTransferOwnerHandler = async (args: TitleEscrowNominateBeneficiaryCommand) => {
  try {
    info(
      `Connecting to the registry ${args.tokenRegistryAddress} and attempting to endorse the change of owner of the transferable record ${args.tokenId} to approved owner and approved holder`,
    );
    warn(
      `Please note that if you do not have the correct privileges to the transferable record, then this command will fail.`,
    );

    const { transactionReceipt } = await endorseNominatedBeneficiary(args);
    const network = args.network as NetworkCmdName;

    displayTransactionPrice(transactionReceipt as unknown as TransactionReceiptFees, network);
    const { hash: transactionHash } = transactionReceipt;

    success(
      `Transferable record with hash ${args.tokenId}'s holder has been successfully endorsed to approved beneficiary at ${args.newBeneficiary}`,
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
 * Endorses a nominated beneficiary by transferring the beneficiary role to the new address.
 * This operation confirms the beneficiary nomination and completes the beneficiary transfer.
 *
 * @param tokenRegistryAddress - The address of the token registry contract
 * @param tokenId - The unique identifier of the token
 * @param remark - Optional remark/comment to attach to the transaction
 * @param encryptionKey - Optional encryption key for encrypting the remark
 * @param newBeneficiary - The address of the new beneficiary to endorse
 * @param network - The blockchain network to execute the transaction on
 * @param rest - Additional parameters (e.g., wallet configuration, gas settings)
 * @returns Promise resolving to an object containing the transaction receipt and nominated beneficiary address
 * @throws Error if provider is required but not available, or if transaction receipt is not found
 */
export const endorseNominatedBeneficiary = async ({
  tokenRegistryAddress,
  tokenId,
  remark,
  encryptionKey,
  newBeneficiary,
  network,
  ...rest
}: TitleEscrowNominateBeneficiaryCommand): Promise<{
  transactionReceipt: TransactionReceipt;
  nominatedBeneficiary: string;
}> => {
  // Initialize wallet/signer for the transaction
  const wallet = await getWalletOrSigner({ network, ...rest });

  // Get the network ID for the specified network
  const networkId = getSupportedNetwork(network).networkId;

  // Set the nominated beneficiary
  const nominatedBeneficiary = newBeneficiary;

  // Automatic dry run for Ethereum and Polygon networks
  const shouldProceed = await performDryRunWithConfirmation({
    network,
    getTransactionCallback: async () => {
      const titleEscrow = await connectToTitleEscrow({
        tokenId,
        address: tokenRegistryAddress,
        wallet,
      });
      
      // Validate the nomination
      await validateNominateBeneficiary({ beneficiaryNominee: nominatedBeneficiary, titleEscrow });
      
      // Validate and encrypt the remark with document ID as encryption key
      const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);
      
      // Populate the transaction for gas estimation
      const tx = await titleEscrow.transferBeneficiary.populateTransaction(
        nominatedBeneficiary,
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

    // Execute beneficiary transfer with EIP-1559 gas parameters
    transaction = await transferBeneficiaryImpl(
      { tokenRegistryAddress, tokenId },
      wallet,
      { remarks: remark, newBeneficiaryAddress: nominatedBeneficiary },
      {
        chainId: networkId as unknown as CHAIN_ID,
        maxFeePerGas: gasFees.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
        id: encryptionKey,
      },
    );
  } else {
    // Execute beneficiary transfer without gas estimation (for networks that don't support it)
    transaction = await transferBeneficiaryImpl(
      { tokenRegistryAddress, tokenId },
      wallet,
      { remarks: remark, newBeneficiaryAddress: nominatedBeneficiary },
      {
        chainId: networkId as unknown as CHAIN_ID,
        id: encryptionKey,
      },
    );
  }

  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  const transactionReceipt = (await transaction.wait()) as unknown as TransactionReceipt;
  if (!transactionReceipt) {
    throw new Error('Transaction receipt not found');
  }
  return {
    transactionReceipt,
    nominatedBeneficiary,
  };
};
