import { info, success } from 'signale';
import { rejectTransferOwnersObligationRegistry } from '@trustvc/trustvc';
import { BaseObligationEscrowCommand } from '../../types';
import {
  displayTransactionPrice,
  getEtherscanAddress,
  NetworkCmdName,
  TransactionReceiptFees,
} from '../../utils';
import { promptBaseObligationEscrowInputs, runObligationEscrowCommand } from './shared';
import { runObligationEscrowTx } from './runTx';

export const command = 'reject-transfer-owner-holder';
export const describe = 'Reject a pending joint owner+holder transfer on a BoE obligation';

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, rejectTransferOwnersHandler);

export const promptForInputs = promptBaseObligationEscrowInputs;

export const rejectTransferOwnersHandler = async (args: BaseObligationEscrowCommand) => {
  info(`Rejecting owners transfer for obligation ${args.tokenId}`);
  const transaction = await runObligationEscrowTx({
    args,
    populate: ({ escrow }, encryptedRemark) =>
      escrow.rejectTransferOwners.populateTransaction(encryptedRemark),
    sdk: rejectTransferOwnersObligationRegistry as any,
    sdkParams: { remarks: args.remark },
  });
  displayTransactionPrice(
    transaction as unknown as TransactionReceiptFees,
    args.network as NetworkCmdName,
  );
  success(`Owners transfer rejected`);
  info(
    `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
  );
};
