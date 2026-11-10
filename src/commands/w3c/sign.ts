import { confirm, input, select } from '@inquirer/prompts';
import {
  compressTemplateFromFiles,
  isDirectoryValid,
  readJsonFile,
  validateInputFileExists,
  writeFile,
} from '../../utils';
import { DocumentBuilder, issuer, RawVerifiableCredential, signW3C } from '@trustvc/trustvc';
import { SignInput } from '../../types';
import signale from 'signale';

export const command = 'w3c-sign';
export const describe = 'Sign a Verifiable Credential using a did key-pair file';

export const handler = async () => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await sign(answers);
  } catch (err: unknown) {
    signale.error(`${err instanceof Error ? err.message : String(err)}`);
  }
};

export const promptForInputs = async (): Promise<SignInput> => {
  const pathToCredentialFile = await input({
    message: 'Please enter the path to your Verifiable Credential JSON file:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Verifiable Credential JSON file path is required';
      }
      return true;
    },
  });
  const credential: RawVerifiableCredential = readJsonFile(
    pathToCredentialFile,
    'Verifiable Credential JSON',
  );

  const attachInlineTemplate = await confirm({
    message: 'Attach an inline HTML template as the rendering method for this credential?',
    default: false,
  });

  let inlineTemplate: SignInput['inlineTemplate'];
  if (attachInlineTemplate) {
    const pathToHtml = await input({
      message: 'Enter the path to your template HTML file:',
      required: true,
      validate: (value: string) => {
        if (!value || value.trim() === '') return 'Template HTML file path is required';
        return validateInputFileExists(value);
      },
    });

    const pathToCss = await input({
      message: 'Enter the path to your template CSS file:',
      required: true,
      validate: (value: string) => {
        if (!value || value.trim() === '') return 'Template CSS file path is required';
        return validateInputFileExists(value);
      },
    });

    const templateName = await input({
      message: 'Enter a name for this template (e.g. BILL_OF_LADING):',
      required: true,
      validate: (value: string) => {
        if (!value || value.trim() === '') return 'Template name is required';
        return true;
      },
    });

    inlineTemplate = {
      pathToHtml: pathToHtml.trim(),
      pathToCss: pathToCss.trim(),
      templateName: templateName.trim(),
    };
  }

  const pathToKeypairFile = await input({
    message: 'Please enter the path to your did key-pair JSON file:',
    required: true,
    default: './didKeyPairs.json',
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'did key-pair JSON file path is required';
      }
      return true;
    },
  });
  const keyPairData: typeof issuer.IssuedDIDOption = readJsonFile(pathToKeypairFile, 'key pair');

  const encryptionAlgorithm = await select({
    message: 'Select the encryption algorithm used to generate the key pair:',
    choices: [
      {
        name: 'ECDSA-SD-2023',
        value: 'ecdsa-sd-2023',
        description: 'Sign credential using ECDSA-SD-2023 suite',
      },
      { name: 'BBS-2023', value: 'bbs-2023', description: 'Sign credential using BBS-2023 suite' },
    ],
    default: 'ECDSA-SD-2023',
  });

  const pathToSignedVC = await input({
    message: 'Enter a directory to save the signed Verifiable Credential (optional):',
    required: false,
    default: '.',
  });

  if (!isDirectoryValid(pathToSignedVC)) throw new Error('Output path is not valid');

  return {
    credential,
    keyPairData,
    encryptionAlgorithm,
    pathToSignedVC,
    ...(inlineTemplate ? { inlineTemplate } : {}),
  };
};

/**
 * Compresses the raw HTML + CSS and attaches it as the credential's INLINE_HTML_TEMPLATE
 * renderMethod, via the same `DocumentBuilder.inlineHtmlTemplate()` the SDK exposes — this
 * keeps the renderMethod-replacement and `@context` handling identical to building the
 * credential with DocumentBuilder directly, rather than reimplementing it here.
 */
const attachInlineHtmlTemplate = async (
  credential: RawVerifiableCredential,
  inlineTemplate: NonNullable<SignInput['inlineTemplate']>,
): Promise<RawVerifiableCredential> => {
  const template = await compressTemplateFromFiles(inlineTemplate);
  const builder = new DocumentBuilder(credential);
  builder.inlineHtmlTemplate(template);
  return JSON.parse(builder.toString());
};

export const sign = async ({
  credential,
  keyPairData,
  encryptionAlgorithm,
  pathToSignedVC,
  inlineTemplate,
}: SignInput): Promise<void> => {
  const credentialToSign = inlineTemplate
    ? await attachInlineHtmlTemplate(credential, inlineTemplate)
    : credential;

  const signedVC = await signW3C(credentialToSign, keyPairData, encryptionAlgorithm);
  if (signedVC?.signed) {
    signale.success('Verifiable Credential signed successfully');
    const signedVCPath = `${pathToSignedVC}/signed_vc.json`;
    writeFile(signedVCPath, signedVC.signed, true);
    signale.success(`Signed verifiable credential saved to: ${signedVCPath}`);
  } else {
    signale.error(signedVC.error);
  }
};
