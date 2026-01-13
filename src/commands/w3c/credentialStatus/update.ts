import { confirm, input, number, select } from '@inquirer/prompts';
import { signW3C, credentialStatus } from '@trustvc/trustvc';
import signale from 'signale';
import { CredentialStatusQuestionType } from '../../../types';
import { isDirectoryValid, readJsonFile } from '../../../utils';
import { saveSignedCredentialStatus } from './create';

export const command = 'credential-status-update';
export const describe = 'Update an existing credential status list';

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
  const answers: CredentialStatusQuestionType = {
    continue: false,
  };

  answers.hostingUrl = await input({
    message:
      'Enter the URL where your credential status is currently hosted (e.g., https://example.com/credentials/statuslist/1):',
    required: true,
  });

  let credentialStatusVC: any;
  try {
    const response = await fetch(answers.hostingUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    credentialStatusVC = await response.json();
  } catch (_err: unknown) {
    signale.error(`Failed to fetch credential status from: ${answers.hostingUrl}`);
    throw new Error(`Invalid URL or credential status not found: ${answers.hostingUrl}`);
  }

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

  answers.outputPath = await input({
    message: 'Enter a directory to save the updated credential status file (optional):',
    default: '.',
    required: true,
  });

  if (!isDirectoryValid(answers.outputPath)) {
    throw new Error(`Invalid directory path: ${answers.outputPath}`);
  }

  answers.type = credentialStatusVC?.credentialSubject?.type;

  if (answers.type === 'BitstringStatusList') {
    answers.credentialStatus = await credentialStatus.StatusList.decode({
      encodedList: credentialStatusVC.credentialSubject.encodedList,
    });

    answers.purpose = credentialStatusVC.credentialSubject
      .statusPurpose as typeof credentialStatus.CredentialStatusPurpose;

    answers.continue = await confirm({
      message: 'Do you want to update the status list?',
      default: false,
    });

    while (answers.continue) {
      answers.index = await number({
        message: 'Enter the index of the status list to update:',
        min: 0,
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
  }

  return answers;
};

export const createSignedCredentialStatus = async (answers: CredentialStatusQuestionType) => {
  try {
    if (answers.type === 'BitstringStatusList') {
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
    }

    throw new Error('Invalid credential status type.');
  } catch (err: unknown) {
    if (!(err instanceof Error)) {
      signale.error('Failed to sign credential status');
      return;
    }
    signale.error(err.message);
  }
};
