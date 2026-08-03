import { info, success } from 'signale';
import { dischargeObligationRegistry } from '@trustvc/trustvc';
import { BaseObligationEscrowCommand } from '../../types';
import {
  displayTransactionPrice,
  getEtherscanAddress,
  NetworkCmdName,
  TransactionReceiptFees,
} from '../../utils';
import { promptBaseObligationEscrowInputs, runObligationEscrowCommand } from './shared';
import { runObligationEscrowTx } from './runTx';

export const command = 'discharge';
export const describe =
  'Beneficiary discharges an accepted BoE obligation (Accepted → Discharged, burns)';

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, dischargeHandler);

export const promptForInputs = promptBaseObligationEscrowInputs;

export const dischargeHandler = async (args: BaseObligationEscrowCommand) => {
  info(`Discharging obligation token ${args.tokenId} on ${args.obligationRegistryAddress}`);
  const transaction = await runObligationEscrowTx({
    args,
    populate: ({ escrow }, encryptedRemark) =>
      escrow.discharge.populateTransaction(encryptedRemark),
    sdk: dischargeObligationRegistry as any,
    sdkParams: { remarks: args.remark },
  });
  if (!transaction) return;
  displayTransactionPrice(
    transaction as unknown as TransactionReceiptFees,
    args.network as NetworkCmdName,
  );
  success(`Obligation ${args.tokenId} discharged`);
  info(
    `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
  );
};
