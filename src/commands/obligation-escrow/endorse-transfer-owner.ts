import { error, info, success } from 'signale';
import { transferBeneficiaryObligationRegistry } from '@trustvc/trustvc';
import { ObligationEscrowNominateBeneficiaryCommand } from '../../types';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptAddress,
  TransactionReceiptFees,
} from '../../utils';
import { promptBaseObligationEscrowInputs, runObligationEscrowCommand } from './shared';
import { runObligationEscrowTx } from './runTx';

export const command = 'endorse-transfer-owner';
export const describe = 'Endorse / transfer beneficiary (owner) of a BoE obligation';

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, endorseHandler);

export const promptForInputs = async (): Promise<ObligationEscrowNominateBeneficiaryCommand> => {
  const base = await promptBaseObligationEscrowInputs();
  const newBeneficiary = await promptAddress('new beneficiary', 'endorsed owner');
  return { ...base, newBeneficiary } as ObligationEscrowNominateBeneficiaryCommand;
};

export const endorseHandler = async (args: ObligationEscrowNominateBeneficiaryCommand) => {
  try {
    info(`Transferring beneficiary to ${args.newBeneficiary} for obligation ${args.tokenId}`);
    const transaction = await runObligationEscrowTx({
      args,
      populate: ({ escrow }, encryptedRemark) =>
        escrow.transferBeneficiary.populateTransaction(args.newBeneficiary, encryptedRemark),
      sdk: transferBeneficiaryObligationRegistry as any,
      sdkParams: { newBeneficiaryAddress: args.newBeneficiary, remarks: args.remark },
    });
    if (!transaction) return;
    displayTransactionPrice(
      transaction as unknown as TransactionReceiptFees,
      args.network as NetworkCmdName,
    );
    success(`Beneficiary transferred to ${args.newBeneficiary}`);
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
    );
  } catch (e) {
    error(getErrorMessage(e));
    process.exitCode = 1;
  }
};
