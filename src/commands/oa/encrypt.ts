import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import signale from 'signale';
import { encryptString } from '@trustvc/trustvc';
import {
  readFile,
  writeFile,
  getCliErrorMessage,
  ensureInputFileExists,
  resolveOutputJsonPath,
  validateInputFileExists,
} from '../../utils';

export const command = 'oa-encrypt';
export const describe = 'Encrypt a document in order to share and store it safely';

type EncryptInput = {
  inputDocumentPath: string;
  outputEncryptedPath: string;
};

export const promptForInputs = async (): Promise<EncryptInput | null> => {
  const inputDocumentPath = await input({
    message: 'Enter the path to your document:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') return 'Document path is required';
      return validateInputFileExists(value);
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

  return {
    inputDocumentPath: inputDocumentPath.trim(),
    outputEncryptedPath: outputEncryptedPath.trim(),
  };
};

const ENCRYPT_ERROR_OPTIONS = {
  defaultMessage: 'An unexpected error occurred while encrypting the document.',
  fileNotFound: 'Unable to read input document. File not found at: {path}',
  permissionDenied: 'Permission denied. Cannot write to: {path}',
} as const;

/** Reads document from disk, encrypts with generated key, writes payload (no key in file), prints key. */
async function runEncrypt(answers: EncryptInput): Promise<void> {
  const { inputDocumentPath, outputEncryptedPath } = answers;

  ensureInputFileExists(inputDocumentPath);
  const documentString = readFile(inputDocumentPath);
  const { key, ...encryptedDocument } = encryptString(documentString);

  const { path: outputPath, generated } = resolveOutputJsonPath(outputEncryptedPath, 'encrypted');
  writeFile(outputPath, encryptedDocument, true);

  if (generated) {
    signale.success(`No output filename provided. Encrypted document saved to: ${outputPath}`);
  } else {
    signale.success(`Encrypted document saved to: ${outputPath}`);
  }
  signale.warn(
    `Here is the key to decrypt the document: don't lose it: ${chalk.hsl(39, 100, 50)(key)}`,
  );
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
