import { input, password } from '@inquirer/prompts';
import crypto from 'crypto';
import signale from 'signale';
import { encryptString } from '@trustvc/trustvc';
import { readFile, writeFile, getCliErrorMessage } from '../../utils';

/** Derive a 64-char hex key from passphrase for AES-256 (OPEN-ATTESTATION-TYPE-1). */
const deriveKey = (passphrase: string): string =>
  crypto.createHash('sha256').update(passphrase, 'utf8').digest('hex');

export const command = 'oa-encrypt';
export const describe =
  'Encrypt a document for safe sharing and storage. You will be asked for an encryption key — remember it to decrypt later.';

type EncryptInput = {
  inputDocumentPath: string;
  outputEncryptedPath: string;
  key: string;
};

export const promptForInputs = async (): Promise<EncryptInput | null> => {
  const inputDocumentPath = await input({
    message: 'Enter the path to your document:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') return 'Document path is required';
      return true;
    },
  });

  const outputEncryptedPath = await input({
    message: 'Enter the path to save the encrypted document:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') return 'Output path is required';
      return true;
    },
  });

  const key = await password({
    message: 'Enter the encryption key (remember it to decrypt later):',
    mask: '*',
    validate: (value: string) => {
      if (!value || value.trim() === '') return 'Encryption key is required';
      return true;
    },
  });

  return {
    inputDocumentPath: inputDocumentPath.trim(),
    outputEncryptedPath: outputEncryptedPath.trim(),
    key: key.trim(),
  };
};

const ENCRYPT_ERROR_OPTIONS = {
  defaultMessage: 'An unexpected error occurred while encrypting the document.',
  fileNotFound: 'Unable to read input document. File not found at: {path}',
  permissionDenied: 'Permission denied. Cannot write to: {path}',
} as const;

/** Reads document from disk, encrypts it, writes payload and shows success message. */
async function runEncrypt(answers: EncryptInput): Promise<void> {
  const { inputDocumentPath, outputEncryptedPath, key } = answers;

  const documentString = readFile(inputDocumentPath);
  const { cipherText, iv, tag, type } = encryptString(documentString, deriveKey(key));

  const encryptedPayload = { cipherText, iv, tag, type };
  writeFile(outputEncryptedPath, encryptedPayload, true);

  signale.success(`Encrypted document saved to: ${outputEncryptedPath}`);
  signale.warn('Remember the encryption key you entered — you will need it to decrypt.');
}

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await runEncrypt(answers);
  } catch (err: unknown) {
    signale.error(getCliErrorMessage(err, ENCRYPT_ERROR_OPTIONS));
    process.exitCode = 1;
  }
};
