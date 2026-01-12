// External dependencies
import signale from 'signale';
import { TransactionReceipt } from 'ethers';
import { CHAIN_ID, nominate as nominateImpl } from '@trustvc/trustvc';

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
