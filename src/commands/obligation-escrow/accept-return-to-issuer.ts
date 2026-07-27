import { error, info, success } from 'signale';
import { acceptReturnedObligationRegistry } from '@trustvc/trustvc';
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

export const command = 'accept-return-to-issuer';
export const describe = 'Issuer accepts a returned BoE obligation (burn / shred)';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await acceptReturnedHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

export const promptForInputs = promptBaseObligationEscrowInputs;

export const acceptReturnedHandler = async (args: BaseObligationEscrowCommand) => {
  try {
    info(`Accepting returned obligation ${args.tokenId}`);
    const transaction = await runObligationEscrowTx({
      args,
      // acceptReturned burns the title, which lives on the TrustVCToken registry, not the escrow.
      populate: ({ registry }, encryptedRemark) =>
        registry.burn.populateTransaction(args.tokenId, encryptedRemark),
      sdk: acceptReturnedObligationRegistry as any,
      sdkParams: { tokenId: args.tokenId, remarks: args.remark },
    });
    displayTransactionPrice(
      transaction as unknown as TransactionReceiptFees,
      args.network as NetworkCmdName,
    );
    success(`Return accepted (burned)`);
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
    );
  } catch (e) {
    error(getErrorMessage(e));
  }
};
