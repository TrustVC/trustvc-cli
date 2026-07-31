import { error, info, success } from 'signale';
import { rejectObligationRegistry } from '@trustvc/trustvc';
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

export const command = 'reject';
export const describe = 'Holder rejects an issued BoE obligation (terminal Rejected)';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await rejectHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

export const promptForInputs = promptBaseObligationEscrowInputs;

export const rejectHandler = async (args: BaseObligationEscrowCommand) => {
  try {
    info(`Rejecting obligation token ${args.tokenId} on ${args.obligationRegistryAddress}`);
    const transaction = await runObligationEscrowTx({
      args,
      populate: ({ escrow }, encryptedRemark) => escrow.reject.populateTransaction(encryptedRemark),
      sdk: rejectObligationRegistry as any,
      sdkParams: { remarks: args.remark },
    });
    if (!transaction) return;
    displayTransactionPrice(
      transaction as unknown as TransactionReceiptFees,
      args.network as NetworkCmdName,
    );
    success(`Obligation ${args.tokenId} rejected`);
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
    );
  } catch (e) {
    error(getErrorMessage(e));
    process.exitCode = 1;
  }
};
