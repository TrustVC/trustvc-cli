import { info, success } from 'signale';
import { returnToIssuerObligationRegistry } from '@trustvc/trustvc';
import { BaseObligationEscrowCommand } from '../../types';
import {
  displayTransactionPrice,
  getEtherscanAddress,
  NetworkCmdName,
  TransactionReceiptFees,
} from '../../utils';
import { promptBaseObligationEscrowInputs, runObligationEscrowCommand } from './shared';
import { runObligationEscrowTx } from './runTx';

export const command = 'return-to-issuer';
export const describe = 'Return a BoE obligation to the issuer (dual role, same as classic ETR)';

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, returnToIssuerHandler);

export const promptForInputs = promptBaseObligationEscrowInputs;

export const returnToIssuerHandler = async (args: BaseObligationEscrowCommand) => {
  info(`Returning obligation ${args.tokenId} to issuer`);
  const transaction = await runObligationEscrowTx({
    args,
    populate: ({ escrow }, encryptedRemark) =>
      escrow.returnToIssuer.populateTransaction(encryptedRemark),
    sdk: returnToIssuerObligationRegistry as any,
    sdkParams: { remarks: args.remark },
  });
  if (!transaction) return;
  displayTransactionPrice(
    transaction as unknown as TransactionReceiptFees,
    args.network as NetworkCmdName,
  );
  success(`Returned to issuer`);
  info(
    `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
  );
};
