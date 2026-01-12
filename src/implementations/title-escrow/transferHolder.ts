// External dependencies
import signale from 'signale';
import { TransactionReceipt, ContractTransactionResponse } from 'ethers';
import { CHAIN_ID, transferHolder as transferHolderImpl } from '@trustvc/trustvc';

// Internal utilities
import { getSupportedNetwork, getWalletOrSigner } from '../../utils';
import { connectToTitleEscrow, validateAndEncryptRemark } from './helpers';
import { TitleEscrowTransferHolderCommand } from '../../types';
import { dryRunMode } from '../../utils';
import { canEstimateGasPrice, getGasFees } from '../../utils';

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
