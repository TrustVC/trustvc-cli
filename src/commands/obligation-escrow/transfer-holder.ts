import { error, info, success, warn } from 'signale';
import { transferHolderObligationRegistry } from '@trustvc/trustvc';
import { ObligationEscrowTransferHolderCommand } from '../../types';
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

export const command = 'transfer-holder';
export const describe = 'Transfer the holder of a BoE obligation record';

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, changeHolderHandler);

export const promptForInputs = async (): Promise<ObligationEscrowTransferHolderCommand> => {
  const base = await promptBaseObligationEscrowInputs();
  const newHolder = await promptAddress('new holder', 'new holder');
  return { ...base, newHolder } as ObligationEscrowTransferHolderCommand;
};

export const changeHolderHandler = async (args: ObligationEscrowTransferHolderCommand) => {
  try {
    info(
      `Changing holder of obligation ${args.tokenId} on ${args.obligationRegistryAddress} to ${args.newHolder}`,
    );
    warn('Only the current holder can transfer the holder role.');
    const transaction = await runObligationEscrowTx({
      args,
      populate: ({ escrow }, encryptedRemark) =>
        escrow.transferHolder.populateTransaction(args.newHolder, encryptedRemark),
      sdk: transferHolderObligationRegistry as any,
      sdkParams: { holderAddress: args.newHolder, remarks: args.remark },
    });
    displayTransactionPrice(
      transaction as unknown as TransactionReceiptFees,
      args.network as NetworkCmdName,
    );
    success(`Holder changed to ${args.newHolder}`);
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
    );
  } catch (e) {
    error(getErrorMessage(e));
  }
};
