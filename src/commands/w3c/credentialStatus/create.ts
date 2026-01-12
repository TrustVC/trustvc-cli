import { confirm, input, number, select } from '@inquirer/prompts';
import { signW3C, SignedVerifiableCredential, credentialStatus } from '@trustvc/trustvc';
import signale from 'signale';
import { CredentialStatusQuestionType } from '../../../types';
import { isDirectoryValid, readJsonFile, writeFile } from '../../../utils';

export const command = 'credential-status-create';
export const describe = 'Create a new credential status list';

export const handler = async () => {
  try {
    const answers = await promptQuestions();
    if (!answers) return;

    const signedCSVC = await createSignedCredentialStatus(answers);
    if (!signedCSVC) return;

    await saveSignedCredentialStatus(signedCSVC, answers.outputPath!);
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
  }
};

export const promptQuestions = async (): Promise<CredentialStatusQuestionType | undefined> => {
  const answers: CredentialStatusQuestionType = {};

  answers.keyPairPath = await input({
    message: 'Enter the path to your key pair JSON file:',
    default: './didKeyPairs.json',
    required: true,
  });

  try {
    answers.keypairData = readJsonFile(answers.keyPairPath, 'key pair');
  } catch (_err) {
    signale.error(`Invalid file path provided: ${answers.keyPairPath}`);
    return undefined;
  }

  answers.cryptoSuite = await select({
    message: 'Select an encryption algorithm for your key pair:',
    choices: [
      {
        name: 'ECDSA-SD-2023',
        value: 'ecdsa-sd-2023',
        description: 'Use ECDSA-SD-2023 cryptographic suite',
      },
      {
        name: 'BBS-2023',
        value: 'bbs-2023',
        description: 'Use BBS-2023 cryptographic suite',
      },
    ],
  });

  answers.hostingUrl = await input({
    message: `Enter the URL where you'll host your credential status (e.g., https://example.com/credentials/statuslist/1):`,
    required: true,
  });

  answers.outputPath = await input({
    message: 'Enter a directory to save the credential status file (optional):',
    default: '.',
    required: true,
  });

  if (!isDirectoryValid(answers.outputPath)) {
    throw new Error(`Invalid directory path: ${answers.outputPath}`);
  }

  answers.length = await number({
    message: 'Enter the length of the status list (default 16KB - 131,072):',
    default: 131072,
    required: true,
  });

  answers.credentialStatus = new credentialStatus.StatusList({ length: answers.length });

  answers.purpose = await select<typeof credentialStatus.CredentialStatusPurpose>({
    message: 'Select a purpose for the status list:',
    choices: [
      {
        name: 'Revocation',
        value: 'revocation' as typeof credentialStatus.CredentialStatusPurpose,
      },
      {
        name: 'Suspension',
        value: 'suspension' as typeof credentialStatus.CredentialStatusPurpose,
      },
    ],
  });

  answers.continue = await confirm({
    message: 'Do you want to update the status list?',
    default: false,
  });

  while (answers.continue) {
    answers.index = await number({
      message: 'Enter the index of the status list:',
      min: 0,
      max: (answers.length || 131072) - 1,
      required: true,
    });

    const currentIndexStatus: boolean = (
      answers.credentialStatus as typeof credentialStatus.StatusList
    ).getStatus(answers.index!);

    answers.status = await select<boolean>({
      message: `Select status for index ${answers.index} in the ${answers.purpose} list (current: ${currentIndexStatus}):`,
      choices: [
        {
          name: 'True',
          value: true,
        },
        {
          name: 'False',
          value: false,
        },
      ],
    });

    (answers.credentialStatus as typeof credentialStatus.StatusList).setStatus(
      answers.index!,
      answers.status,
    );

    answers.continue = await confirm({
      message: 'Do you want to update another index?',
      default: false,
    });
  }

  return answers;
};

export const createSignedCredentialStatus = async (answers: CredentialStatusQuestionType) => {
  try {
    const encodedList = await (
      answers.credentialStatus as typeof credentialStatus.StatusList
    ).encode();
    const credentialStatusPayload = await credentialStatus.createCredentialStatusPayload(
      {
        id: answers.hostingUrl!,
        credentialSubject: {
          id: `${answers.hostingUrl}#list`,
          type: 'BitstringStatusList',
          statusPurpose: answers.purpose!,
          encodedList,
        },
      },
      answers.keypairData,
      'BitstringStatusListCredential',
      answers.cryptoSuite,
    );

    const { signed, error } = await signW3C(
      credentialStatusPayload,
      answers.keypairData,
      answers.cryptoSuite,
    );

    if (error) {
      throw new Error(error);
    }

    return signed;
  } catch (err: unknown) {
    if (!(err instanceof Error)) {
      signale.error('Failed to sign credential status');
      return;
    }
    signale.error(err.message);
  }
};

export const saveSignedCredentialStatus = async (
  signedCSVC: SignedVerifiableCredential,
  outputPath: string,
) => {
  const filePath = `${outputPath}/credentialStatus.json`;
  writeFile(filePath, signedCSVC, true);

  console.log(''); // blank line for spacing
  signale.success('Generated credential status list successfully');
  signale.info(`Saved to: ${filePath}`);
  console.log(''); // blank line for spacing
  signale.warn('IMPORTANT: Host this file at the URL you specified!');
};
