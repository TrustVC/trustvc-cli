import { input } from '@inquirer/prompts';
import { error, info, success, warn } from 'signale';
import { endorseNominatedBeneficiary } from '../../implementations/title-escrow/endorseNominatedBeneficiary';
import { TitleEscrowNominateBeneficiaryCommand } from '../../types';
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

export const command = 'endorse-transfer-owner';

export const describe =
  'Endorses the transfer of owner of transferable record to an approved owner and approved holder address';

export const handler = async (): Promise<string | undefined> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await endorseTransferOwner(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<TitleEscrowNominateBeneficiaryCommand> => {
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

  // New Beneficiary Address
  const newBeneficiary = await input({
    message: 'Enter the address of the new beneficiary (owner):',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'New beneficiary address is required';
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
    newBeneficiary,
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
export const endorseTransferOwner = async (args: TitleEscrowNominateBeneficiaryCommand) => {
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
