import { error, info, success } from 'signale';
import { nominateObligationRegistry } from '@trustvc/trustvc';
import { ObligationEscrowNominateBeneficiaryCommand } from '../../types';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptAddress,
  TransactionReceiptFees,
} from '../../utils';
import { promptBaseObligationEscrowInputs } from './shared';
import { runObligationEscrowTx } from './runTx';

export const command = 'nominate-transfer-owner';
export const describe = 'Nominate a new beneficiary (owner) for a BoE obligation';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await nominateHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

export const promptForInputs = async (): Promise<ObligationEscrowNominateBeneficiaryCommand> => {
  const base = await promptBaseObligationEscrowInputs();
  const newBeneficiary = await promptAddress('new beneficiary', 'nominee');
  return { ...base, newBeneficiary } as ObligationEscrowNominateBeneficiaryCommand;
};

export const nominateHandler = async (args: ObligationEscrowNominateBeneficiaryCommand) => {
  try {
    info(`Nominating beneficiary ${args.newBeneficiary} for obligation ${args.tokenId}`);
    const transaction = await runObligationEscrowTx({
      args,
      populate: ({ escrow }, encryptedRemark) =>
        escrow.nominate.populateTransaction(args.newBeneficiary, encryptedRemark),
      sdk: nominateObligationRegistry as any,
      sdkParams: { newBeneficiaryAddress: args.newBeneficiary, remarks: args.remark },
    });
    displayTransactionPrice(
      transaction as unknown as TransactionReceiptFees,
      args.network as NetworkCmdName,
    );
    success(`Nominated ${args.newBeneficiary}`);
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
    );
  } catch (e) {
    error(getErrorMessage(e));
  }
};
