import { info, success } from 'signale';
import { rejectTransferBeneficiaryObligationRegistry } from '@trustvc/trustvc';
import { BaseObligationEscrowCommand } from '../../types';
import {
  displayTransactionPrice,
  getEtherscanAddress,
  NetworkCmdName,
  TransactionReceiptFees,
} from '../../utils';
import { promptBaseObligationEscrowInputs, runObligationEscrowCommand } from './shared';
import { runObligationEscrowTx } from './runTx';

export const command = 'reject-transfer-owner';
export const describe = 'Reject a pending beneficiary transfer on a BoE obligation';

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, rejectTransferOwnerHandler);

export const promptForInputs = promptBaseObligationEscrowInputs;

export const rejectTransferOwnerHandler = async (args: BaseObligationEscrowCommand) => {
  info(`Rejecting beneficiary transfer for obligation ${args.tokenId}`);
  const transaction = await runObligationEscrowTx({
    args,
    populate: ({ escrow }, encryptedRemark) =>
      escrow.rejectTransferBeneficiary.populateTransaction(encryptedRemark),
    sdk: rejectTransferBeneficiaryObligationRegistry as any,
    sdkParams: { remarks: args.remark },
  });
  displayTransactionPrice(
    transaction as unknown as TransactionReceiptFees,
    args.network as NetworkCmdName,
  );
  success(`Beneficiary transfer rejected`);
  info(
    `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
  );
};
