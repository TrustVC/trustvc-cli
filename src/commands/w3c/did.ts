import { input } from '@inquirer/prompts';
import { issuer } from '@trustvc/trustvc';
import signale from 'signale';
import { isDirectoryValid, readJsonFile, writeFile } from '../../utils';

export const command = 'did-web';
export const describe = 'Generate a DID token file from an existing key pair and a domain name';

export const handler = async () => {
  try {
    const answers = await promptQuestions();
    if (!answers) return;

    const { keypairData, outputPath } = answers;
    const did = await getIssuedDid(keypairData);
    if (!did) return;

    await saveIssuedDid(did, outputPath);
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
  }
};

export const getIssuedDid = async (
  keypairData: typeof issuer.IssuedDIDOption,
): Promise<typeof issuer.IssuedDID> => {
  try {
    // Issue the DID
    const did: typeof issuer.IssuedDID = await issuer.issueDID(keypairData);
    return did;
  } catch (err) {
    if (err instanceof Error) {
      if (err.message == 'Missing domain' || err.message == 'Invalid domain') {
        throw new Error(`Error generating DID token: ${err.message}`);
      } else if (err.message === 'KeyPair already exists') {
        throw new Error('Error generating DID token: KeyPair already exists in DID Document');
      } else {
        throw new Error('Error generating DID token');
      }
    }
    throw new Error('Error generating DID token');
  }
};

export const saveIssuedDid = async (wellKnownDid: typeof issuer.IssuedDID, outputPath: string) => {
  const wellknownPath = `${outputPath}/wellknown.json`;
  const keypairsPath = `${outputPath}/didKeyPairs.json`;

  writeFile(wellknownPath, wellKnownDid.wellKnownDid, true);
  writeFile(keypairsPath, wellKnownDid.didKeyPairs, true);

  console.log(''); // blank line for spacing
  signale.success('Generated DID files successfully');
  signale.info(`${wellknownPath} → Publish at /.well-known/did.json`);
  signale.info(`${keypairsPath} → Keep private (contains secret keys)`);
  console.log(''); // blank line for spacing
  signale.warn('IMPORTANT: Never share didKeyPairs.json publicly!');
  signale.note(
    'Learn more: https://docs.tradetrust.io/docs/how-tos/issuer/did-web#host-the-document',
  );
};

export const promptQuestions = async () => {
  // Prompt for the key pair path
  const keyPairPath = await input({
    message: 'Enter the path to your key pair JSON file:',
    default: './keypair.json',
  });

  // Validate and read the key pair file
  const keypairData: typeof issuer.IssuedDIDOption = readJsonFile(keyPairPath, 'key pair');

  // Prompt for domain name
  const domainName = await input({
    message:
      'Enter the domain where your did:web public key will be hosted (e.g., https://example.com/.well-known/did.json):',
  });

  // Prompt for output path
  const outputPath = await input({
    message: 'Enter a directory to save the generated DID token file (optional):',
    default: '.',
  });

  if (!isDirectoryValid(outputPath)) throw new Error('Output path is not valid');
  keypairData.domain = domainName;

  return { keypairData, domainName, outputPath };
};
