import { input } from '@inquirer/prompts';
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
  validateNominateBeneficiary,
} from '../helpers';

export const command = 'nominate-change-owner';

export const describe = 'Nominates the change of owner of transferable record to another address';

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
 * @param dryRun - If true, simulates the transaction without executing it
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
  dryRun,
  ...rest
}: TitleEscrowNominateBeneficiaryCommand): Promise<TransactionReceipt> => {
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

  // Validate the beneficiary nomination
  await validateNominateBeneficiary({ beneficiaryNominee: newBeneficiary, titleEscrow });
  // Dry run mode: estimate gas and exit without executing the transaction
  if (dryRun) {
    await validateNominateBeneficiary({ beneficiaryNominee: newBeneficiary, titleEscrow });
    await dryRunMode({
      estimatedGas: await titleEscrow.estimateGas.nominate(newBeneficiary, encryptedRemark),
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
