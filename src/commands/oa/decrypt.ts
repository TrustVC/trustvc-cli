import fs from 'fs';
import { input, password } from '@inquirer/prompts';
import signale from 'signale';
import { decryptString } from '@trustvc/trustvc';
import {
  readDocumentFile,
  getCliErrorMessage,
  isErrorWithMessage,
  ensureInputFileExists,
  resolveOutputJsonPath,
  validateInputFileExists,
} from '../../utils';

export const command = 'oa-decrypt';
export const describe = 'Decrypt a document encrypted with a key';

type DecryptInput = {
  inputEncryptedPath: string;
  outputPath: string;
  key: string;
};

// Payload format: OPEN-ATTESTATION-TYPE-1 (cipherText, iv, tag, type)
const ENCRYPTED_DOCUMENT_TYPE = 'OPEN-ATTESTATION-TYPE-1';

/** Message thrown by @trustvc/trustvc when decryption fails (wrong key or corrupted data). */
const DECRYPT_FAILED_LIBRARY_MESSAGE = 'Error decrypting message';

const INVALID_PAYLOAD_MESSAGE =
  'Invalid encrypted document: expected cipherText, iv, tag and type "OPEN-ATTESTATION-TYPE-1".';

export const promptForInputs = async (): Promise<DecryptInput | null> => {
  const inputEncryptedPath = await input({
    message: 'Enter the path to the encrypted document:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') return 'Encrypted document path is required';
      return validateInputFileExists(value);
    },
  });

  const outputPath = await input({
    message: 'Enter the path to save the decrypted document:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') return 'Output path is required';
      return true;
    },
  });

  const key = await password({
    message: 'Enter the decryption key (hex key from encrypt):',
    mask: '*',
    validate: (value: string) => {
      if (!value || value.trim() === '') return 'Decryption key is required';
      return true;
    },
  });

  return {
    inputEncryptedPath: inputEncryptedPath.trim(),
    outputPath: outputPath.trim(),
    key: key.trim(),
  };
};

type EncryptedPayload = {
  cipherText: string;
  iv: string;
  tag: string;
  type: string;
};

const DECRYPT_ERROR_OPTIONS = {
  defaultMessage: 'An unexpected error occurred while decrypting the document.',
  fileNotFound: 'Unable to read encrypted document. File not found at: {path}',
  permissionDenied: 'Permission denied. Cannot write to: {path}',
  invalidJson: (msg: string) => `Invalid encrypted file: the file is not valid JSON. ${msg}`,
} as const;

/** Validates raw payload and returns typed fields or throws with a clear message. */
function validateEncryptedPayload(payload: unknown): EncryptedPayload {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    !('cipherText' in payload) ||
    !('iv' in payload) ||
    !('tag' in payload) ||
    !('type' in payload)
  ) {
    throw new Error(INVALID_PAYLOAD_MESSAGE);
  }
  const { cipherText, iv, tag, type } = payload as EncryptedPayload;
  if (
    typeof cipherText !== 'string' ||
    typeof iv !== 'string' ||
    typeof tag !== 'string' ||
    type !== ENCRYPTED_DOCUMENT_TYPE
  ) {
    throw new Error(INVALID_PAYLOAD_MESSAGE);
  }
  return { cipherText, iv, tag, type };
}

/** Decrypts payload with key (hex, as returned by encrypt); rethrows a user-friendly error on library failure. */
function decryptPayload(payload: EncryptedPayload, key: string): string {
  try {
    return decryptString({
      ...payload,
      key: key.trim(),
    });
  } catch (err: unknown) {
    if (isErrorWithMessage(err) && err.message === DECRYPT_FAILED_LIBRARY_MESSAGE) {
      throw new Error(
        'Failed to decrypt document. The key is likely incorrect or the file is corrupted.',
      );
    }
    throw err;
  }
}

/** Loads encrypted file, validates, decrypts, writes plaintext and shows success message. */
async function runDecrypt(answers: DecryptInput): Promise<void> {
  const { inputEncryptedPath, outputPath, key } = answers;

  ensureInputFileExists(inputEncryptedPath);
  const rawPayload = readDocumentFile(inputEncryptedPath);
  const payload = validateEncryptedPayload(rawPayload);
  const documentString = decryptPayload(payload, key);

  const { path: outputFilePath, generated } = resolveOutputJsonPath(outputPath, 'decrypted');
  fs.writeFileSync(outputFilePath, documentString, 'utf8');
  if (generated) {
    signale.success(`No output filename provided. Decrypted document saved to: ${outputFilePath}`);
  } else {
    signale.success(`Decrypted document saved to: ${outputFilePath}`);
  }
}

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await runDecrypt(answers);
  } catch (err: unknown) {
    signale.error(getCliErrorMessage(err, DECRYPT_ERROR_OPTIONS));
    process.exitCode = 1;
  }
};
