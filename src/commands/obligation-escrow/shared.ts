import { error } from 'signale';
import {
  promptWalletSelection,
  promptAndReadDocument,
  promptRemark,
  extractObligationDocumentInfo,
  verifyDocumentSignature,
  getErrorMessage,
} from '../../utils';
import { BaseObligationEscrowCommand } from '../../types';

/**
 * Shared prompt flow for obligation-escrow commands that only need document + wallet + remark.
 * Mirrors title-escrow prompt shape (throws on cancel / invalid input).
 */
export const promptBaseObligationEscrowInputs = async (): Promise<BaseObligationEscrowCommand> => {
  const document = await promptAndReadDocument();
  await verifyDocumentSignature(document);
  const { obligationRegistry, tokenId, network, documentId } =
    await extractObligationDocumentInfo(document);
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();
  const remark = await promptRemark('v5');

  const baseResult = {
    network,
    obligationRegistryAddress: obligationRegistry,
    tokenId,
    remark,
    encryptionKey: documentId,
    maxPriorityFeePerGasScale: 1,
  };

  if (encryptedWalletPath) {
    return { ...baseResult, encryptedWalletPath } as BaseObligationEscrowCommand;
  }
  if (keyFile) {
    return { ...baseResult, keyFile } as BaseObligationEscrowCommand;
  }
  if (key) {
    return { ...baseResult, key } as BaseObligationEscrowCommand;
  }
  return baseResult as BaseObligationEscrowCommand;
};

/**
 * Runs prompt → command with the same try/catch shape as title-escrow handlers.
 */
export const runObligationEscrowCommand = async <TArgs>(
  promptForInputs: () => Promise<TArgs>,
  commandHandler: (args: TArgs) => Promise<void>,
): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await commandHandler(answers);
  } catch (e) {
    error(getErrorMessage(e));
  }
};
