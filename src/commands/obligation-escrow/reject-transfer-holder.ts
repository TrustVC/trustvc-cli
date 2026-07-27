import { error, info, success } from 'signale';
import { rejectTransferHolderObligationRegistry } from '@trustvc/trustvc';
import { BaseObligationEscrowCommand } from '../../types';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  TransactionReceiptFees,
} from '../../utils';
import { promptBaseObligationEscrowInputs } from './shared';
import { runObligationEscrowTx } from './runTx';

export const command = 'reject-transfer-holder';
export const describe = 'Reject a pending holder transfer on a BoE obligation';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await rejectTransferHolderHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

export const promptForInputs = promptBaseObligationEscrowInputs;

export const rejectTransferHolderHandler = async (args: BaseObligationEscrowCommand) => {
  try {
    info(`Rejecting holder transfer for obligation ${args.tokenId}`);
    const transaction = await runObligationEscrowTx({
      args,
      populate: ({ escrow }, encryptedRemark) =>
        escrow.rejectTransferHolder.populateTransaction(encryptedRemark),
      sdk: rejectTransferHolderObligationRegistry as any,
      sdkParams: { remarks: args.remark },
    });
    displayTransactionPrice(
      transaction as unknown as TransactionReceiptFees,
      args.network as NetworkCmdName,
    );
    success(`Holder transfer rejected`);
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
    );
  } catch (e) {
    error(getErrorMessage(e));
  }
};
