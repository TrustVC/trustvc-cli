import { input } from '@inquirer/prompts';
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
import {
  connectToTitleEscrow,
  validateAndEncryptRemark,
} from '../helpers';

export const command = 'change-holder';

export const describe = 'Changes the holder of the transferable record to another address';

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
    message: 'Enter the document hash (tokenId) of the transferable record:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Token ID is required';
      }
      return true;
    },
  });

  // New Holder Address
  const newHolder = await input({
    message: 'Enter the address of the new holder:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'New holder address is required';
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
        return 'Invalid Ethereum address format';
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
    newHolder,
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
 * @param dryRun - If true, simulates the transaction without executing it
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
  dryRun,
  ...rest
}: TitleEscrowTransferHolderCommand): Promise<TransactionReceipt> => {
  // Initialize wallet/signer for the transaction
  const wallet = await getWalletOrSigner({ network, ...rest });

  // Get the network ID for the specified network
  const networkId = getSupportedNetwork(network).networkId;

  // Validate and encrypt the remark if encryption key is provided
  const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);
  // Dry run mode: estimate gas and exit without executing the transaction
  if (dryRun) {
    // Connect to the title escrow contract for gas estimation
    const titleEscrow = await connectToTitleEscrow({
      tokenId,
      address: tokenRegistryAddress,
      wallet,
    });

    await dryRunMode({
      estimatedGas: await titleEscrow.estimateGas.transferHolder(to, encryptedRemark),
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
  // Wait for transaction to be mined
  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  const receipt = await transaction.wait();

  // Validate receipt exists
  if (!receipt) {
    throw new Error('Transaction receipt is null');
  }

  return receipt as unknown as TransactionReceipt;
};
