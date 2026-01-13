import { input, select } from '@inquirer/prompts';
import { issuer } from '@trustvc/trustvc';
import signale from 'signale';
import { isDirectoryValid, writeFile } from '../../utils';

export const command = 'key-pair-generation';
export const describe = 'Generate a new key pair file';

export const handler = async () => {
  try {
    const answers = await promptQuestions();
    if (!answers) return;

    const { encAlgo, seedBase58, keyPath } = answers;
    await generateAndSaveKeyPair(encAlgo, seedBase58, keyPath);
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
  }
};

export const promptQuestions = async () => {
  const encAlgo = await select({
    message: 'Select an encryption algorithm for your new key pair:',
    choices: [
      {
        name: 'ECDSA-SD-2023',
        value: 'ecdsa-sd-2023',
        description: 'Generate KeyPair for ECDSA-SD-2023 suite',
      },
      {
        name: 'BBS-2023',
        value: 'bbs-2023',
        description: 'Generate KeyPair for BBS-2023 suite',
      },
    ],
  });

  // Only prompt for seed if BBS-2023 is selected (ECDSA-SD-2023 doesn't support custom seeds)
  let seedBase58 = '';
  if (encAlgo === 'bbs-2023') {
    seedBase58 = await input({
      message: 'Enter a seed in base58 format (optional):',
      default: '',
    });
  }

  const keyPath = await input({
    message: 'Enter a directory to save the generated key file (optional):',
    default: '.',
    required: true,
  });

  if (!isDirectoryValid(keyPath)) {
    throw new Error(`Invalid file path provided: ${keyPath}`);
  }

  return { encAlgo, seedBase58, keyPath };
};

export const generateAndSaveKeyPair = async (
  encAlgo: string,
  seedBase58: string,
  keyPath: string,
) => {
  if (seedBase58) {
    signale.info('Generating keys from provided seed...');
  }

  const keyFilePath = `${keyPath}/keypair.json`;

  const keypairOptions: typeof issuer.GenerateKeyPairOptions = {
    type: encAlgo,
    seedBase58,
  };

  let keypairData: typeof issuer.GeneratedKeyPair;
  try {
    keypairData = await issuer.generateKeyPair(keypairOptions);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message == 'Non-base58btc character') {
        throw new Error('Invalid seed provided. Please provide a valid seed in base58 format.');
      }
    }
    throw new Error('Error generating keypair');
  }

  const keyPair: typeof issuer.GeneratedKeyPair = {
    type: keypairData.type,
  };

  if (keypairData.type === issuer.VerificationType.Multikey) {
    if (keypairData.seedBase58) {
      keyPair.seedBase58 = keypairData.seedBase58;
    }
    keyPair.secretKeyMultibase = keypairData.secretKeyMultibase;
    keyPair.publicKeyMultibase = keypairData.publicKeyMultibase;
  }

  writeFile(keyFilePath, keyPair, true);

  console.log(''); // blank line for spacing
  signale.success('Generated key pair successfully');
  signale.info(`Saved to: ${keyFilePath}`);
  console.log(''); // blank line for spacing
  signale.warn('IMPORTANT: Never share this file publicly - it contains secret keys!');

  return keypairData;
};
