import { error, info, success, warn } from 'signale';
import signale from 'signale';
import { TransactionReceipt } from 'ethers';
import { CHAIN_ID, nominate as nominateImpl } from '@trustvc/trustvc';
import { TitleEscrowNominateBeneficiaryCommand } from '../../types';
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
  promptAddress,
  performDryRunWithConfirmation,
} from '../../utils';
import {
  connectToTitleEscrow,
  validateAndEncryptRemark,
  validateNominateBeneficiary,
} from '../helpers';

export const command = 'nominate-transfer-owner';

export const describe = 'Nominates the transfer of owner of transferable record to another address';

export const handler = async (): Promise<string | undefined> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await nominateChangeOwnerHandler(answers);
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
  const newBeneficiary = await promptAddress('beneficiary', 'new beneficiary (owner)');

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

// Nominate the change of owner with the provided inputs
export const nominateChangeOwnerHandler = async (args: TitleEscrowNominateBeneficiaryCommand) => {
  try {
    info(
      `Connecting to the registry ${args.tokenRegistryAddress} and attempting to nominate the change of owner of the transferable record ${args.tokenId} to new owner at ${args.newBeneficiary}`,
    );
    warn(
      `Please note that if you do not have the correct privileges to the transferable record, then this command will fail.`,
    );

    const transaction = await nominateBeneficiary(args);

    const network = args.network as NetworkCmdName;
    displayTransactionPrice(transaction as unknown as TransactionReceiptFees, network);
    const { hash: transactionHash } = transaction;

    success(
      `Transferable record with hash ${args.tokenId}'s holder has been successfully nominated to new owner with address ${args.newBeneficiary}`,
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
 * Nominates a new beneficiary for a transferable record.
 * This creates a nomination that must be endorsed to complete the beneficiary transfer.
 *
 * @param tokenRegistryAddress - The address of the token registry contract
 * @param tokenId - The unique identifier of the token
 * @param newBeneficiary - The address of the new beneficiary to nominate
 * @param remark - Optional remark/comment to attach to the transaction
 * @param encryptionKey - Optional encryption key for encrypting the remark
 * @param network - The blockchain network to execute the transaction on
 * @param rest - Additional parameters (e.g., wallet configuration, gas settings)
 * @returns Promise resolving to the transaction receipt
 * @throws Error if provider is required but not available, or if transaction receipt is null
 */
export const nominateBeneficiary = async ({
  tokenRegistryAddress,
  tokenId,
  newBeneficiary,
  remark,
  encryptionKey,
  network,
  ...rest
}: TitleEscrowNominateBeneficiaryCommand): Promise<TransactionReceipt> => {
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

      // Validate the beneficiary nomination
      await validateNominateBeneficiary({ beneficiaryNominee: newBeneficiary, titleEscrow });

      // Validate and encrypt the remark if encryption key is provided
      const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);

      // Populate the transaction for gas estimation
      const tx = await titleEscrow.nominate.populateTransaction(newBeneficiary, encryptedRemark);

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

    // Execute nomination with EIP-1559 gas parameters
    transaction = await nominateImpl(
      { tokenRegistryAddress, tokenId },
      wallet,
      { remarks: remark, newBeneficiaryAddress: newBeneficiary },
      {
        chainId: networkId as unknown as CHAIN_ID,
        maxFeePerGas: gasFees.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
        id: encryptionKey,
      },
    );
  } else {
    // Execute nomination without gas estimation (for networks that don't support it)
    transaction = await nominateImpl(
      { tokenRegistryAddress, tokenId },
      wallet,
      { remarks: remark, newBeneficiaryAddress: newBeneficiary },
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
