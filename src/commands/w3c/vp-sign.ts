import { input, number, select } from '@inquirer/prompts';
import { PrivateKeyPair, SignedVerifiableCredential, signW3CPresentation } from '@trustvc/trustvc';
import fs from 'fs';
import path from 'path';
import signale from 'signale';
import { VpLifetime, VpSignInput } from '../../types';
import {
  isDir,
  isDirectoryValid,
  isFile,
  readJsonFile,
  validateInputFileExists,
  writeFile,
} from '../../utils';

export const command = 'vp-sign';
export const describe =
  'Create and sign a W3C Verifiable Presentation from signed Verifiable Credential(s)';

export const handler = async () => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await signPresentation(answers);
  } catch (err: unknown) {
    signale.error(`${err instanceof Error ? err.message : String(err)}`);
  }
};

/**
 * The holder DID a key pair belongs to: its `controller`, or the DID part of its
 * verification-method `id` (`did:key:z...#z...` -> `did:key:z...`).
 */
export const getHolderDidFromKeyPair = (keyPair: PrivateKeyPair): string | undefined =>
  keyPair?.controller || keyPair?.id?.split('#')[0];

const splitPaths = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

/**
 * The credentials to present: a directory (every file in it is taken as a credential), a
 * single file, or several files comma-separated.
 *
 * A directory is NOT filtered by extension or content — whatever is in it is presented, and
 * anything that is not a valid credential is reported by the signing step rather than being
 * silently dropped. Sub-directories and dot-files (`.DS_Store` and friends) are skipped:
 * they are OS noise, never something a user put there to present.
 */
export const resolveCredentialPaths = (value: string): string[] => {
  const entries = splitPaths(value);
  if (entries.length !== 1 || !isDir(entries[0])) return entries;

  const directory = entries[0];
  const files = fs
    .readdirSync(directory)
    .filter((name) => !name.startsWith('.'))
    .map((name) => path.join(directory, name))
    .filter((entry) => isFile(entry))
    .sort();

  if (files.length === 0) throw new Error(`No files found in directory: ${directory}`);
  return files;
};

export const promptForInputs = async (): Promise<VpSignInput> => {
  const credentialPathInput = await input({
    message:
      'Please enter a directory of signed Verifiable Credentials, or the path(s) to individual JSON file(s) (comma-separated):',
    required: true,
    validate: (value: string) => {
      const entries = splitPaths(value);
      if (entries.length === 0) return 'A directory or at least one credential file is required';
      // A single directory is accepted as-is; every file inside it will be presented.
      if (entries.length === 1 && isDir(entries[0])) return true;
      for (const entry of entries) {
        const result = validateInputFileExists(entry);
        if (result !== true) return result;
      }
      return true;
    },
  });

  const credentialPaths = resolveCredentialPaths(credentialPathInput);
  if (credentialPaths.length > 1) {
    signale.info(`Presenting ${credentialPaths.length} credentials:`);
    credentialPaths.forEach((entry, index) => signale.info(`  [${index}] ${entry}`));
  }

  const credentials: SignedVerifiableCredential[] = credentialPaths.map((entry) =>
    readJsonFile<SignedVerifiableCredential>(entry, 'Verifiable Credential JSON'),
  );

  const pathToKeypairFile = await input({
    message: 'Please enter the path to the holder did key-pair JSON file:',
    required: true,
    default: './didKeyPairs.json',
    validate: (value: string) => validateInputFileExists(value),
  });

  const keyPairData: PrivateKeyPair = readJsonFile(pathToKeypairFile, 'key pair');

  // The holder is NOT asked for: trustvc enforces that the signing key's DID *is* the holder,
  // so any other answer could only ever fail. A key pair with no DID cannot sign a
  // presentation at all, so say that here rather than let the library report a missing
  // "controller" further down.
  const holder = getHolderDidFromKeyPair(keyPairData);
  if (!holder) {
    throw new Error(
      `The key pair at ${pathToKeypairFile} is not bound to a DID (no "controller"). ` +
        'Create one with "trustvc did-web" and use the didKeyPairs.json it writes.',
    );
  }
  signale.info(`Holder: ${holder}`);

  const lifetime = await promptForLifetime();

  const outputPath = await input({
    message: 'Enter a directory to save the signed Verifiable Presentation (optional):',
    required: false,
    default: '.',
  });

  if (!isDirectoryValid(outputPath)) throw new Error('Output path is not valid');

  return {
    credentials,
    credentialPaths,
    keyPairData,
    holder,
    lifetime,
    outputPath,
  };
};

/** A VP lifetime is mandatory at the trustvc layer — it cannot be left to a default. */
export const promptForLifetime = async (): Promise<VpLifetime> => {
  const mode = await select({
    message: 'How should the presentation expiry be set?',
    choices: [
      {
        name: 'Expires in a number of seconds from now',
        value: 'expiresInSeconds',
        description: 'Stamp validUntil relative to the current time',
      },
      {
        name: 'Explicit validUntil timestamp',
        value: 'validUntil',
        description: 'Provide an absolute ISO 8601 expiry',
      },
    ],
    default: 'expiresInSeconds',
  });

  if (mode === 'validUntil') {
    const validUntil = await input({
      message: 'Enter the validUntil timestamp (ISO 8601, e.g. 2026-01-01T00:00:00Z):',
      required: true,
      validate: (value: string) => {
        const parsed = new Date(value.trim());
        if (Number.isNaN(parsed.getTime())) return 'Enter a valid ISO 8601 timestamp';
        if (parsed.getTime() <= Date.now()) return 'validUntil must be in the future';
        return true;
      },
    });
    return { validUntil: validUntil.trim() };
  }

  const expiresInSeconds = await number({
    message: 'Enter the presentation lifetime in seconds:',
    default: 600,
    required: true,
    min: 1,
  });

  return { expiresInSeconds: expiresInSeconds as number };
};

/**
 * trustvc reports a rejected credential by its position ("credential at index 2 is not
 * valid: ..."). With a whole directory presented at once that position means nothing on its
 * own, so name the file it came from.
 */
export const nameFailingCredential = (error: string, credentialPaths?: string[]): string => {
  if (!credentialPaths?.length) return error;
  return error.replace(/credential at index (\d+)/g, (match, index) => {
    const source = credentialPaths[Number(index)];
    return source ? `${match} (${source})` : match;
  });
};

export const signPresentation = async ({
  credentials,
  credentialPaths,
  keyPairData,
  holder,
  lifetime,
  outputPath,
}: VpSignInput): Promise<void> => {
  // A single credential is presented as-is; multiple are presented as an array.
  const verifiableCredential = credentials.length === 1 ? credentials[0] : credentials;

  // No `challenge` is passed, so the holder proof is always an assertionMethod proof:
  // an authentication (anti-replay) proof can only be verified against the challenge the
  // verifier issued, which `trustvc verify` has no way to take.
  const { signed, error } = await signW3CPresentation(verifiableCredential, keyPairData, {
    holder,
    ...lifetime,
  });

  if (!signed) {
    signale.error(
      error
        ? nameFailingCredential(error, credentialPaths)
        : 'Failed to sign the Verifiable Presentation',
    );
    return;
  }

  signale.success('Verifiable Presentation signed successfully');

  const signedVpPath = `${outputPath}/signed_vp.json`;
  writeFile(signedVpPath, signed, true);
  signale.success(`Signed verifiable presentation saved to: ${signedVpPath}`);
};
