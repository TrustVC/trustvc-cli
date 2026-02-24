import fs from 'fs';
import { input, password } from '@inquirer/prompts';
import crypto from 'crypto';
import signale from 'signale';
import { decryptString } from '@trustvc/trustvc';
import { readDocumentFile } from '../../utils';

/** Derive a 64-char hex key from passphrase for AES-256 (OPEN-ATTESTATION-TYPE-1). */
const deriveKey = (passphrase: string): string =>
  crypto.createHash('sha256').update(passphrase, 'utf8').digest('hex');

export const command = 'oa-decrypt';
export const describe =
  'Decrypt a document that was encrypted using oa-encrypt. You will be asked for the decryption key.';

type DecryptInput = {
  inputEncryptedPath: string;
  outputPath: string;
  key: string;
};

// Payload format: OPEN-ATTESTATION-TYPE-1 (cipherText, iv, tag, type)
const ENCRYPTED_DOCUMENT_TYPE = 'OPEN-ATTESTATION-TYPE-1';

export const promptForInputs = async (): Promise<DecryptInput | null> => {
  const inputEncryptedPath = await input({
    message: 'Enter the path to the encrypted document:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') return 'Encrypted document path is required';
      return true;
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
    message: 'Enter the decryption key:',
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

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    const { inputEncryptedPath, outputPath, key } = answers;

    const encryptedPayload = readDocumentFile(inputEncryptedPath);
    
    const { cipherText, iv, tag, type } = encryptedPayload;
    if (!cipherText || !iv || !tag || type !== ENCRYPTED_DOCUMENT_TYPE) {
      throw new Error(
        'Invalid encrypted document: expected cipherText, iv, tag and type "OPEN-ATTESTATION-TYPE-1".',
      );
    }

    const documentString = decryptString({
      cipherText,
      iv,
      tag,
      key: deriveKey(key),
      type,
    });

    fs.writeFileSync(outputPath, documentString, 'utf8');
    signale.success(`Decrypted document saved to: ${outputPath}`);
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
    throw err;
  }
};
