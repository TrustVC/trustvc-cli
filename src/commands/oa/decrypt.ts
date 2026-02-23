import { input, password } from '@inquirer/prompts';
import signale from 'signale';
import {
  decrypt,
  isRawV2Document,
  isRawV3Document,
  isWrappedV2Document,
  isWrappedV3Document,
} from '@trustvc/trustvc';
import { readDocumentFile, writeFile } from '../../utils';

export const command = 'oa-decrypt';
export const describe =
  'Decrypt an Open Attestation document that was encrypted using oa-encrypt. You will be asked for the decryption key.';

type DecryptInput = {
  inputEncryptedPath: string;
  outputPath: string;
  key: string;
};

const ENCRYPTED_DOCUMENT_TYPE = 'encrypted-document';

const isOADocument = (doc: unknown): boolean =>
  isRawV2Document(doc) ||
  isRawV3Document(doc) ||
  isWrappedV2Document(doc) ||
  isWrappedV3Document(doc);

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

    if (encryptedPayload?.type !== ENCRYPTED_DOCUMENT_TYPE || !encryptedPayload?.ciphertext) {
      throw new Error(
        'Invalid encrypted document: expected an object with type "encrypted-document" and "ciphertext" field.',
      );
    }

    const documentString = decrypt(encryptedPayload.ciphertext, key);
    let document: unknown;
    try {
      document = JSON.parse(documentString);
    } catch {
      throw new Error(
        'Decryption succeeded but the result is not valid JSON. The key may be incorrect.',
      );
    }

    if (!isOADocument(document)) {
      throw new Error(
        'Decrypted content is not a valid Open Attestation document. Expected raw OA v2/v3 or wrapped OA v2/v3.',
      );
    }

    writeFile(outputPath, document, true);
    signale.success(`Decrypted document saved to: ${outputPath}`);
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
    throw err;
  }
};
