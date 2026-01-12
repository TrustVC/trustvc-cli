// External dependencies
import signale from 'signale';
import { TransactionReceipt } from 'ethers';
import { CHAIN_ID, transferOwners as transferOwnersImpl } from '@trustvc/trustvc';

// Internal utilities
import { getSupportedNetwork, getWalletOrSigner } from '../../utils';
import {
  connectToTitleEscrow,
  validateAndEncryptRemark,
  validateEndorseChangeOwner,
} from './helpers';
import { TitleEscrowEndorseTransferOfOwnersCommand } from '../../types';
import { dryRunMode } from '../../utils';
import { canEstimateGasPrice, getGasFees } from '../../utils';

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
