import signale from 'signale';
import { getWalletOrSigner } from '../../utils/wallet';
import { TokenRegistryMintCommand } from '../../commands/token-registry/token-registry-command.type';
import { TransactionReceipt } from '@ethersproject/providers';
import { canEstimateGasPrice, getGasFees } from '../../utils';
import { BigNumber } from 'ethers';
import { getTokenRegistryAddress, mint } from '@trustvc/trustvc';
import { hash } from 'crypto';

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
  let transactionOptions: { maxFeePerGas?: BigNumber; maxPriorityFeePerGas?: BigNumber } = {};

  if (dryRun) {
    console.log('🔧 Dry run mode is currently undergoing upgrades and will be available soon.');
    process.exit(0);
  }

  if (canEstimateGasPrice(network)) {
    const gasFees = await getGasFees({ provider: wallet.provider, ...rest });
    transactionOptions = {
      maxFeePerGas: gasFees.maxFeePerGas as BigNumber,
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas as BigNumber,
    };
  }

  const transaction = await mint(
    { tokenRegistryAddress: address },
    wallet,
    { beneficiaryAddress: beneficiary, holderAddress: holder, tokenId, remarks: remark },
    { id: encryptionKey, ...transactionOptions },
  );
  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  return transaction.wait();
};
