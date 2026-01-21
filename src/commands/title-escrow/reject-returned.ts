import { input } from '@inquirer/prompts';
import { error, success, info } from 'signale';
import signale from 'signale';
import { TransactionReceipt } from 'ethers';
import { v5Contracts, CHAIN_ID, rejectReturned as rejectReturnedImpl } from '@trustvc/trustvc';
import { BaseTitleEscrowCommand as TitleEscrowReturnDocumentCommand } from '../../types';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptRemarkAndEncryptionKey,
  promptNetworkSelection,
  promptWalletSelection,
  TransactionReceiptFees,
  getSupportedNetwork,
  getWalletOrSigner,
  dryRunMode,
  canEstimateGasPrice,
  getGasFees,
} from '../../utils';
import { validateAndEncryptRemark } from '../helpers';

const { TradeTrustToken__factory } = v5Contracts;

export const command = 'reject-returned';

export const describe = 'Rejects a returned transferable record on the blockchain';

export const handler = async (): Promise<string | undefined> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await rejectReturnedDocumentHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<TitleEscrowReturnDocumentCommand> => {
  // Network selection
  const network = await promptNetworkSelection();

  // Token Registry Address
  const tokenRegistry = await input({
    message: 'Enter the token registry contract address:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Token registry address is required';
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
        return 'Invalid Ethereum address format';
      }
      return true;
    },
  });

  // Token ID (Document Hash)
  const tokenId = await input({
    message: 'Enter the document hash (tokenId) to reject:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Token ID is required';
      }
      return true;
    },
  });

  // Wallet selection
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

  // Optional: Remark and Encryption Key
  const { remark, encryptionKey } = await promptRemarkAndEncryptionKey();

  // Build the result object
  const baseResult = {
    network,
    tokenRegistryAddress: tokenRegistry,
    tokenId,
    remark,
    encryptionKey,
    dryRun: false,
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

// Reject the returned document with the provided inputs
export const rejectReturnedDocumentHandler = async (args: TitleEscrowReturnDocumentCommand) => {
  try {
    info(`Rejecting returned document with hash ${args.tokenId}`);

    const transaction = await rejectReturned(args);

    const network = args.network as NetworkCmdName;
    displayTransactionPrice(transaction as unknown as TransactionReceiptFees, network);
    const { hash: transactionHash } = transaction;

    success(`Returned transferable record with hash ${args.tokenId} has been rejected.`);
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transactionHash}`,
    );

    return args.tokenRegistryAddress;
  } catch (e) {
    error(getErrorMessage(e));
  }
};

/**
 * Rejects a returned transferable record and restores it to the previous state.
 * This operation is performed by the issuer to reject a document that was returned to them.
 *
 * @param tokenRegistryAddress - The address of the token registry contract
 * @param tokenId - The unique identifier of the token to reject and restore
 * @param remark - Optional remark/comment to attach to the transaction
 * @param encryptionKey - Optional encryption key for encrypting the remark
 * @param network - The blockchain network to execute the transaction on
 * @param dryRun - If true, simulates the transaction without executing it
 * @param rest - Additional parameters (e.g., wallet configuration, gas settings)
 * @returns Promise resolving to the transaction receipt
 * @throws Error if provider is required but not available, or if transaction receipt is null
 */
export const rejectReturned = async ({
  tokenRegistryAddress,
  tokenId,
  remark,
  encryptionKey,
  network,
  dryRun,
  ...rest
}: TitleEscrowReturnDocumentCommand): Promise<TransactionReceipt> => {
  // Initialize wallet/signer for the transaction
  const wallet = await getWalletOrSigner({ network, ...rest });

  // Get the network ID for the specified network
  const networkId = getSupportedNetwork(network).networkId;

  // Connect to the token registry contract instance
  const tokenRegistryInstance = await TradeTrustToken__factory.connect(
    tokenRegistryAddress,
    wallet,
  );

  // Validate and encrypt the remark if encryption key is provided
  const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);
  // Dry run mode: estimate gas and exit without executing the transaction
  if (dryRun) {
    await dryRunMode({
      estimatedGas: await tokenRegistryInstance.estimateGas.restore(tokenId, encryptedRemark),
      network,
    });
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

    // Execute reject returned with EIP-1559 gas parameters
    transaction = await rejectReturnedImpl(
      { tokenRegistryAddress },
      wallet,
      { tokenId, remarks: remark },
      {
        chainId: networkId as unknown as CHAIN_ID,
        maxFeePerGas: gasFees.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
        id: encryptionKey,
      },
    );
  } else {
    // Execute reject returned without gas estimation (for networks that don't support it)
    transaction = await rejectReturnedImpl(
      { tokenRegistryAddress },
      wallet,
      { tokenId, remarks: remark },
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
