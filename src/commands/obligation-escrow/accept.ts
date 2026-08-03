import { error, info, success } from 'signale';
import { acceptObligationRegistry } from '@trustvc/trustvc';
import { BaseObligationEscrowCommand } from '../../types';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  TransactionReceiptFees,
} from '../../utils';
import { promptBaseObligationEscrowInputs, runObligationEscrowCommand } from './shared';
import { runObligationEscrowTx } from './runTx';

export const command = 'accept';
export const describe = 'Holder accepts an issued BoE obligation (Issued → Accepted)';

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, acceptHandler);

export const promptForInputs = promptBaseObligationEscrowInputs;

export const acceptHandler = async (args: BaseObligationEscrowCommand) => {
  try {
    info(`Accepting obligation token ${args.tokenId} on ${args.obligationRegistryAddress}`);
    const transaction = await runObligationEscrowTx({
      args,
      populate: ({ escrow }, encryptedRemark) => escrow.accept.populateTransaction(encryptedRemark),
      sdk: acceptObligationRegistry as any,
      sdkParams: { remarks: args.remark },
    });
    displayTransactionPrice(
      transaction as unknown as TransactionReceiptFees,
      args.network as NetworkCmdName,
    );
    success(`Obligation ${args.tokenId} accepted`);
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
    );
  } catch (e) {
    error(getErrorMessage(e));
  }
};
