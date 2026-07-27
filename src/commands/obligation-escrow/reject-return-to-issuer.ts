import { error, info, success } from 'signale';
import { rejectReturnedObligationRegistry } from '@trustvc/trustvc';
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

export const command = 'reject-return-to-issuer';
export const describe = 'Issuer rejects a returned BoE obligation (restore to escrow)';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await rejectReturnedHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

export const promptForInputs = promptBaseObligationEscrowInputs;

export const rejectReturnedHandler = async (args: BaseObligationEscrowCommand) => {
  try {
    info(`Rejecting returned obligation ${args.tokenId} (restore)`);
    const transaction = await runObligationEscrowTx({
      args,
      // rejectReturned restores the title, which lives on the TrustVCToken registry, not the escrow.
      populate: ({ registry }, encryptedRemark) =>
        registry.restore.populateTransaction(args.tokenId, encryptedRemark),
      sdk: rejectReturnedObligationRegistry as any,
      sdkParams: { tokenId: args.tokenId, remarks: args.remark },
    });
    displayTransactionPrice(
      transaction as unknown as TransactionReceiptFees,
      args.network as NetworkCmdName,
    );
    success(`Return rejected (restored to escrow)`);
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
    );
  } catch (e) {
    error(getErrorMessage(e));
  }
};
