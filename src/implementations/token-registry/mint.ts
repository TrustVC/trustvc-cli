import signale from 'signale';
import { getWalletOrSigner } from '../../utils/wallet';
import { TokenRegistryMintCommand } from '../../types';
import { TransactionReceipt, BigNumberish } from 'ethers';
import { canEstimateGasPrice, getGasFees } from '../../utils';
import { mint } from '@trustvc/trustvc';

export const mintToTokenRegistry = async ({
  address,
  beneficiary,
  holder,
  tokenId,
  remark,
  encryptionKey,
  network,
  dryRun,
  ...rest
}: TokenRegistryMintCommand): Promise<TransactionReceipt> => {
  const wallet = await getWalletOrSigner({ network, ...rest });
  let transactionOptions: { maxFeePerGas?: BigNumberish; maxPriorityFeePerGas?: BigNumberish } = {};

  if (dryRun) {
    console.log('🔧 Dry run mode is currently undergoing upgrades and will be available soon.');
    process.exit(0);
  }

  if (canEstimateGasPrice(network)) {
    if (!wallet.provider) {
      throw new Error('Provider is required for gas estimation');
    }
    const gasFees = await getGasFees({ provider: wallet.provider, ...rest });
    transactionOptions = {
      maxFeePerGas: gasFees.maxFeePerGas as BigNumberish,
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas as BigNumberish,
    };
  }

  const transaction = await mint(
    { tokenRegistryAddress: address },
    wallet,
    { beneficiaryAddress: beneficiary, holderAddress: holder, tokenId, remarks: remark },
    { id: encryptionKey, ...transactionOptions },
  );
  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  const receipt = (await transaction.wait()) as unknown as TransactionReceipt;
  if (!receipt) {
    throw new Error('Transaction receipt not found');
  }
  return receipt;
};
