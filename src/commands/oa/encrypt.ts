import { input, password } from '@inquirer/prompts';
import signale from 'signale';
import {
  encrypt,
  isRawV2Document,
  isRawV3Document,
  isWrappedV2Document,
  isWrappedV3Document,
} from '@trustvc/trustvc';
import { readDocumentFile, writeFile } from '../../utils';

export const command = 'oa-encrypt';
export const describe =
  'Encrypt an Open Attestation document for safe sharing and storage. You will be asked for an encryption key — remember it to decrypt later.';

type EncryptInput = {
  inputDocumentPath: string;
  outputEncryptedPath: string;
  key: string;
};

const ENCRYPTED_DOCUMENT_TYPE = 'encrypted-document';

const isOADocument = (doc: unknown): boolean =>
  isRawV2Document(doc) ||
  isRawV3Document(doc) ||
  isWrappedV2Document(doc) ||
  isWrappedV3Document(doc);

export const promptForInputs = async (): Promise<EncryptInput | null> => {
  const inputDocumentPath = await input({
    message: 'Enter the path to your Open Attestation document:',
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

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    const { inputDocumentPath, outputEncryptedPath, key } = answers;

    const document = readDocumentFile(inputDocumentPath);
    if (!isOADocument(document)) {
      throw new Error(
        'The document is not a valid Open Attestation document. Expected raw OA v2/v3 or wrapped OA v2/v3.',
      );
    }
    const documentString = JSON.stringify(document);

    const ciphertext = encrypt(documentString, key);

    const encryptedPayload = {
      type: ENCRYPTED_DOCUMENT_TYPE,
      ciphertext,
    };

    writeFile(outputEncryptedPath, encryptedPayload, true);
    signale.success(`Encrypted document saved to: ${outputEncryptedPath}`);
    signale.warn('Remember the encryption key you entered — you will need it to decrypt.');
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
    throw err;
  }
};
