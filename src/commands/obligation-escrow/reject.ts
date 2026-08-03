import { info, success } from 'signale';
import { rejectObligationRegistry } from '@trustvc/trustvc';
import { BaseObligationEscrowCommand } from '../../types';
import {
  displayTransactionPrice,
  getEtherscanAddress,
  NetworkCmdName,
  TransactionReceiptFees,
} from '../../utils';
import { promptBaseObligationEscrowInputs, runObligationEscrowCommand } from './shared';
import { runObligationEscrowTx } from './runTx';

export const command = 'reject';
export const describe = 'Holder rejects an issued BoE obligation (Issued → Rejected, burns)';

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, rejectHandler);

export const promptForInputs = promptBaseObligationEscrowInputs;

export const rejectHandler = async (args: BaseObligationEscrowCommand) => {
  info(`Rejecting obligation token ${args.tokenId} on ${args.obligationRegistryAddress}`);
  const transaction = await runObligationEscrowTx({
    args,
    populate: ({ escrow }, encryptedRemark) => escrow.reject.populateTransaction(encryptedRemark),
    sdk: rejectObligationRegistry as any,
    sdkParams: { remarks: args.remark },
  });
  displayTransactionPrice(
    transaction as unknown as TransactionReceiptFees,
    args.network as NetworkCmdName,
  );
  success(`Obligation ${args.tokenId} rejected`);
  info(
    `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
  );
};
