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

/** @inquirer/prompts rejects with ExitPromptError when the user cancels (e.g. Ctrl+C). */
const isPromptCancellation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'name' in err &&
  (err as { name?: unknown }).name === 'ExitPromptError';

/**
 * Shared prompt flow for obligation-escrow commands that only need document + wallet + remark.
 * Returns null when the user cancels a prompt so runObligationEscrowCommand can exit quietly.
 */
export const promptBaseObligationEscrowInputs =
  async (): Promise<BaseObligationEscrowCommand | null> => {
    try {
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
    } catch (err) {
      if (isPromptCancellation(err)) {
        return null;
      }
      throw err;
    }
  };

/**
 * Runs prompt → command with shared failure logging and non-zero exit on error.
 * Prompt cancellation (falsy answers) returns without setting exitCode.
 */
export const runObligationEscrowCommand = async <TArgs>(
  promptForInputs: () => Promise<TArgs | null | undefined>,
  commandHandler: (args: TArgs) => Promise<void>,
): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await commandHandler(answers);
  } catch (e) {
    error(getErrorMessage(e));
    process.exitCode = 1;
  }
};
