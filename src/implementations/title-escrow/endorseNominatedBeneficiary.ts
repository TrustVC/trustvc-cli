// External dependencies
import signale from 'signale';
import { TransactionReceipt } from 'ethers';
import { CHAIN_ID, transferBeneficiary as transferBeneficiaryImpl } from '@trustvc/trustvc';

// Internal utilities
import { getSupportedNetwork, getWalletOrSigner } from '../../utils';
import {
  connectToTitleEscrow,
  validateAndEncryptRemark,
  validateNominateBeneficiary,
} from './helpers';
import { TitleEscrowNominateBeneficiaryCommand } from '../../types';
import { dryRunMode } from '../../utils';
import { canEstimateGasPrice, getGasFees } from '../../utils';

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
 * @param dryRun - If true, simulates the transaction without executing it
 * @param rest - Additional parameters (e.g., wallet configuration, gas settings)
 * @returns Promise resolving to an object containing the transaction receipt and nominated beneficiary address
 * @throws Error if provider is required but not available, or if transaction receipt is null
 */
export const endorseNominatedBeneficiary = async ({
  tokenRegistryAddress,
  tokenId,
  remark,
  encryptionKey,
  newBeneficiary,
  network,
  dryRun,
  ...rest
}: TitleEscrowNominateBeneficiaryCommand): Promise<{
  transactionReceipt: TransactionReceipt;
  nominatedBeneficiary: string;
}> => {
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

  // Set the nominated beneficiary and validate the nomination
  const nominatedBeneficiary = newBeneficiary;
  await validateNominateBeneficiary({ beneficiaryNominee: nominatedBeneficiary, titleEscrow });

  // Validate and encrypt the remark if encryption key is provided
  const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);
  // Dry run mode: estimate gas and exit without executing the transaction
  if (dryRun) {
    await dryRunMode({
      estimatedGas: await titleEscrow.estimateGas.transferBeneficiary(
        nominatedBeneficiary,
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

  // Wait for transaction to be mined
  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  const transactionReceipt = await transaction.wait();

  // Validate receipt exists
  if (!transactionReceipt) {
    throw new Error('Transaction receipt is null');
  }

  // Return transaction receipt and the nominated beneficiary address
  return {
    transactionReceipt: transactionReceipt as unknown as TransactionReceipt,
    nominatedBeneficiary: nominatedBeneficiary,
  };
};
