import { info, success } from 'signale';
import { transferOwnersObligationRegistry } from '@trustvc/trustvc';
import { ObligationEscrowEndorseTransferOfOwnersCommand } from '../../types';
import {
  displayTransactionPrice,
  getEtherscanAddress,
  NetworkCmdName,
  promptAddress,
  TransactionReceiptFees,
} from '../../utils';
import { promptBaseObligationEscrowInputs, runObligationEscrowCommand } from './shared';
import { runObligationEscrowTx } from './runTx';

export const command = 'transfer-owner-holder';
export const describe = 'Transfer both beneficiary and holder of a BoE obligation';

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, transferOwnersHandler);

export const promptForInputs =
  async (): Promise<ObligationEscrowEndorseTransferOfOwnersCommand> => {
    const base = await promptBaseObligationEscrowInputs();
    const newOwner = await promptAddress('new beneficiary', 'new owner');
    const newHolder = await promptAddress('new holder', 'new holder');
    return { ...base, newOwner, newHolder } as ObligationEscrowEndorseTransferOfOwnersCommand;
  };

export const transferOwnersHandler = async (
  args: ObligationEscrowEndorseTransferOfOwnersCommand,
) => {
  info(
    `Transferring owners of obligation ${args.tokenId} to owner ${args.newOwner} / holder ${args.newHolder}`,
  );
  const transaction = await runObligationEscrowTx({
    args,
    populate: ({ escrow }, encryptedRemark) =>
      escrow.transferOwners.populateTransaction(args.newOwner, args.newHolder, encryptedRemark),
    sdk: transferOwnersObligationRegistry as any,
    sdkParams: {
      newBeneficiaryAddress: args.newOwner,
      newHolderAddress: args.newHolder,
      remarks: args.remark,
    },
  });
  if (!transaction) return;
  displayTransactionPrice(
    transaction as unknown as TransactionReceiptFees,
    args.network as NetworkCmdName,
  );
  success(`Owners transferred`);
  info(
    `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
  );
};
