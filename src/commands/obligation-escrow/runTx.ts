import signale from 'signale';
import { BytesLike, TransactionReceipt } from 'ethers';
import { CHAIN_ID } from '@trustvc/trustvc';
import {
  canEstimateGasPrice,
  getGasFees,
  getSupportedNetwork,
  getWalletOrSigner,
  performDryRunWithConfirmation,
} from '../../utils';
import {
  connectToObligationEscrow,
  connectToObligationRegistry,
  validateAndEncryptRemark,
} from '../helpers';
import { BaseObligationEscrowCommand } from '../../types';

type PopulateFn = (
  contracts: { escrow: any; registry: any },
  encryptedRemark: BytesLike,
) => Promise<any>;

type SdkCall = (
  contractOptions: { obligationRegistry: string; tokenId: string },
  wallet: any,
  params: Record<string, unknown>,
  txOptions: Record<string, unknown>,
) => Promise<{ hash: string; wait: () => Promise<unknown> }>;

/**
 * Shared dry-run + gas + SDK send for obligation-escrow write methods that take remarks.
 */
export const runObligationEscrowTx = async (opts: {
  args: BaseObligationEscrowCommand;
  populate: PopulateFn;
  sdk: SdkCall;
  sdkParams: Record<string, unknown>;
}): Promise<TransactionReceipt> => {
  const { args, populate, sdk, sdkParams } = opts;
  const { obligationRegistryAddress, tokenId, remark, encryptionKey, network, ...rest } = args;
  const wallet = await getWalletOrSigner({ network, ...rest });
  const networkId = getSupportedNetwork(network).networkId;

  const shouldProceed = await performDryRunWithConfirmation({
    network,
    getTransactionCallback: async () => {
      const escrow = await connectToObligationEscrow({
        tokenId,
        address: obligationRegistryAddress,
        wallet,
      });
      const registry = await connectToObligationRegistry({
        address: obligationRegistryAddress,
        wallet,
      });
      const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);
      const tx = await populate({ escrow, registry }, encryptedRemark);
      return { ...tx, from: await wallet.getAddress() };
    },
  });

  if (!shouldProceed) {
    process.exit(0);
  }

  const contractOptions = { obligationRegistry: obligationRegistryAddress, tokenId };
  let transaction;

  if (canEstimateGasPrice(network)) {
    if (!wallet.provider) {
      throw new Error('Provider is required for gas estimation');
    }
    const gasFees = await getGasFees({ provider: wallet.provider, ...rest });
    transaction = await sdk(contractOptions, wallet, sdkParams, {
      chainId: networkId as unknown as CHAIN_ID,
      maxFeePerGas: gasFees.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
      id: encryptionKey,
    });
  } else {
    transaction = await sdk(contractOptions, wallet, sdkParams, {
      chainId: networkId as unknown as CHAIN_ID,
      id: encryptionKey,
    });
  }

  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  const receipt = (await transaction.wait()) as unknown as TransactionReceipt;
  if (!receipt) {
    throw new Error('Transaction receipt not found');
  }
  return receipt;
};
