import { input, select } from '@inquirer/prompts';
import signale from 'signale';
import path from 'path';
import { signOA } from '@trustvc/trustvc';
import type { PrivateKeyOption } from '../../utils';
import type { OASignInput } from '../../types';
import {
  documentsInDirectory,
  getPrivateKey,
  isDirectoryValid,
  readDocumentFile,
  writeDocumentToDisk,
} from '../../utils';

export const command = 'oa-sign';
export const describe = 'Sign OpenAttestation documents with a private key';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await signDocuments(answers);
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
  }
};

export const promptForInputs = async (): Promise<OASignInput> => {
  const rawDocumentsPath = await input({
    message: 'Enter the path to your raw OA document or directory:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Document path is required';
      }
      return true;
    },
  });

  const outputDir = await input({
    message: 'Enter a directory to save the signed documents:',
    default: '.',
  });

  if (!isDirectoryValid(outputDir)) {
    throw new Error('Output path is not valid');
  }

  const publicKey = await input({
    message: 'Enter the public key associated with the documents (e.g., did:ethr:0x...#controller)',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Public key is required';
      }
      return true;
    },
  });

  const keySource = await promptPrivateKeySource();

  return {
    rawDocumentsPath,
    outputDir,
    publicKey,
    ...keySource,
  };
};

const promptPrivateKeySource = async (): Promise<PrivateKeyOption> => {
  const choice = await select({
    message: 'Select private key source:',
    choices: [
      { name: 'Environment variable (OA_PRIVATE_KEY)', value: 'envVariable' },
      { name: 'Private key file', value: 'keyFile' },
      { name: 'Private key value', value: 'keyDirect' },
    ],
    default: 'envVariable',
  });

  if (choice === 'envVariable') {
    if (!process.env.OA_PRIVATE_KEY) {
      throw new Error('OA_PRIVATE_KEY environment variable is not set.');
    }
    signale.info('Using private key from OA_PRIVATE_KEY environment variable');
    return {};
  }

  if (choice === 'keyFile') {
    const keyFile = await input({
      message: 'Enter the path to your private key file:',
      required: true,
    });
    return { keyFile };
  }

  const key = await input({
    message: 'Enter your private key:',
    required: true,
  });
  return { key };
};

export const signDocuments = async ({
  rawDocumentsPath,
  outputDir,
  publicKey,
  key,
  keyFile,
}: OASignInput): Promise<void> => {
  const privateKey = getPrivateKey({ key, keyFile } as PrivateKeyOption);
  if (!privateKey) {
    throw new Error('Private key is not specified (use key, key-file, or OA_PRIVATE_KEY)');
  }

  const documentFileNames = await documentsInDirectory(rawDocumentsPath);
  if (!documentFileNames.length) {
    throw new Error('No valid documents found to sign');
  }

  await Promise.all(
    documentFileNames.map(async (fileName) => {
      const file = await readDocumentFile(fileName);
      const signingKey = {
        private: privateKey,
        public: publicKey,
      };
      const signedDocument = await signOA(file, signingKey);
      const outputFileName = path.parse(fileName).base;
      writeDocumentToDisk(outputDir, outputFileName, signedDocument);
      const outputPath = outputDir.endsWith('/')
        ? `${outputDir}${outputFileName}`
        : `${outputDir}/${outputFileName}`;
      signale.success(`Signed document saved: ${outputPath}`);
    }),
  );
};
