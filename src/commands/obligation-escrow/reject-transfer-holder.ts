import { info, success } from 'signale';
import { rejectTransferHolderObligationRegistry } from '@trustvc/trustvc';
import { BaseObligationEscrowCommand } from '../../types';
import {
  displayTransactionPrice,
  getEtherscanAddress,
  NetworkCmdName,
  TransactionReceiptFees,
} from '../../utils';
import { promptBaseObligationEscrowInputs, runObligationEscrowCommand } from './shared';
import { runObligationEscrowTx } from './runTx';

export const command = 'reject-transfer-holder';
export const describe = 'Reject a pending holder transfer on a BoE obligation';

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, rejectTransferHolderHandler);

export const promptForInputs = promptBaseObligationEscrowInputs;

export const rejectTransferHolderHandler = async (args: BaseObligationEscrowCommand) => {
  info(`Rejecting holder transfer for obligation ${args.tokenId}`);
  const transaction = await runObligationEscrowTx({
    args,
    populate: ({ escrow }, encryptedRemark) =>
      escrow.rejectTransferHolder.populateTransaction(encryptedRemark),
    sdk: rejectTransferHolderObligationRegistry as any,
    sdkParams: { remarks: args.remark },
  });
  if (!transaction) return;
  displayTransactionPrice(
    transaction as unknown as TransactionReceiptFees,
    args.network as NetworkCmdName,
  );
  success(`Holder transfer rejected`);
  info(
    `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
  );
};
