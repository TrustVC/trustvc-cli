import { input } from '@inquirer/prompts';
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
  validateEndorseChangeOwner,
} from '../helpers';

export const command = 'endorse-change-owner';

export const describe = 'Endorses the change of owner of transferable record to another address';

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

  // New Owner Address
  const newOwner = await input({
    message: 'Enter the address of the new owner (beneficiary):',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'New owner address is required';
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
        return 'Invalid Ethereum address format';
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
    newOwner,
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
 * @param dryRun - If true, simulates the transaction without executing it
 * @param rest - Additional parameters (e.g., wallet configuration, gas settings)
 * @returns Promise resolving to the transaction receipt
 * @throws Error if provider is required but not available, or if transaction receipt is null
 */
export const transferOwners = async ({
  tokenRegistryAddress,
  tokenId,
  newHolder,
  newOwner,
  remark,
  encryptionKey,
  network,
  dryRun,
  ...rest
}: TitleEscrowEndorseTransferOfOwnersCommand): Promise<TransactionReceipt> => {
  // Initialize wallet/signer for the transaction
  const wallet = await getWalletOrSigner({ network, ...rest });

  // Get the network ID for the specified network
  const networkId = getSupportedNetwork(network).networkId;

  // Connect to the title escrow contract for this token
  const titleEscrow = await connectToTitleEscrow({
    tokenId,
    address: tokenRegistryAddress,
    wallet,
  });

  // Validate and encrypt the remark if encryption key is provided
  const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);

  // Validate that the new owner and holder are different from current ones
  await validateEndorseChangeOwner({ newHolder, newOwner, titleEscrow });
  // Dry run mode: estimate gas and exit without executing the transaction
  if (dryRun) {
    await dryRunMode({
      estimatedGas: await titleEscrow.estimateGas.transferOwners(
        newOwner,
        newHolder,
        encryptedRemark,
      ),
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

  // Wait for transaction to be mined
  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  const receipt = await transaction.wait();

  // Validate receipt exists
  if (!receipt) {
    throw new Error('Transaction receipt is null');
  }

  return receipt as unknown as TransactionReceipt;
};
