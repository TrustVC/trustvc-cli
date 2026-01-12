import { input, select } from '@inquirer/prompts';
import { error, info, success, warn } from 'signale';
import { transferHolder } from '../../implementations/title-escrow/transferHolder';
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
} from '../../utils';

export const command = 'change-holder';

export const describe = 'Changes the holder of the transferable record to another address';

export const handler = async (): Promise<string | undefined> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await changeHolder(answers);
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
export const changeHolder = async (args: TitleEscrowTransferHolderCommand) => {
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
