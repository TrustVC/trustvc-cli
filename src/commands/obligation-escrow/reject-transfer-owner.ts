import { error, info, success } from 'signale';
import { rejectTransferBeneficiaryObligationRegistry } from '@trustvc/trustvc';
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

export const command = 'reject-transfer-owner';
export const describe = 'Reject a pending beneficiary transfer on a BoE obligation';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await rejectTransferOwnerHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

export const promptForInputs = promptBaseObligationEscrowInputs;

export const rejectTransferOwnerHandler = async (args: BaseObligationEscrowCommand) => {
  try {
    info(`Rejecting beneficiary transfer for obligation ${args.tokenId}`);
    const transaction = await runObligationEscrowTx({
      args,
      populate: ({ escrow }, encryptedRemark) =>
        escrow.rejectTransferBeneficiary.populateTransaction(encryptedRemark),
      sdk: rejectTransferBeneficiaryObligationRegistry as any,
      sdkParams: { remarks: args.remark },
    });
    if (!transaction) return;
    displayTransactionPrice(
      transaction as unknown as TransactionReceiptFees,
      args.network as NetworkCmdName,
    );
    success(`Beneficiary transfer rejected`);
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
    );
  } catch (e) {
    error(getErrorMessage(e));
    process.exitCode = 1;
  }
};
