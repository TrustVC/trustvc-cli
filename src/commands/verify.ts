import { input } from '@inquirer/prompts';
import { Argv } from 'yargs';
import {
  getSupportedNetwork,
  getSupportedNetworkNameFromId,
  readJsonFile,
  CaptureConsoleWarnAsync,
  CaptureConsoleWarn,
  promptNetworkSelection,
  supportedNetwork,
} from '../utils';
import {
  getChainId,
  getDocumentData,
  isDocumentRevokable,
  isObligationRecord,
  isTransferableRecord,
  isWrappedV2Document,
  isWrappedV3Document,
  SignedVerifiableCredential,
  VerificationFragment,
  VerificationFragmentWithData,
  verifyDocument,
  WrappedOrSignedOpenAttestationDocument,
} from '@trustvc/trustvc';
import signale from 'signale';
import type { Provider as V5Provider } from '@ethersproject/providers';
import { FragmentType } from '../types';

const OBLIGATION_RECORDS_FRAGMENT = 'ObligationRecords';

type ObligationDocumentStatusInfo = {
  obligationRegistry: string;
  status?: number;
  terminationReason?: number;
};

type VerifyOptions = {
  network?: string;
};

/** Extract obligation registry info from a VALID ObligationRecords verify fragment. */
export const getObligationDocumentStatus = (
  fragments: VerificationFragment[],
): ObligationDocumentStatusInfo | null => {
  const fragment = fragments.find((f) => f.name === OBLIGATION_RECORDS_FRAGMENT);
  if (!fragment || fragment.status !== 'VALID') return null;

  const data = (
    fragment as {
      data?: { obligationRegistry?: string; status?: number; terminationReason?: number };
    }
  ).data;
  if (!data?.obligationRegistry) return null;

  return {
    obligationRegistry: data.obligationRegistry,
    status: data.status,
    terminationReason: data.terminationReason,
  };
};

export const command = 'verify';
export const describe = 'Verify a W3C or OpenAttestation document (ETR, BoE, or revocable VC)';

export const builder = (yargs: Argv): Argv =>
  yargs.option('network', {
    alias: 'n',
    choices: Object.keys(supportedNetwork),
    description: 'Network provider when document chain lookup fails (skips interactive selection)',
    demandOption: false,
  });

export const handler = async (argv: { network?: string }) => {
  try {
    const signedVC = await promptQuestions();
    if (!signedVC) return;

    await verify(signedVC, { network: argv.network });
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
  }
};

export const promptQuestions = async (): Promise<SignedVerifiableCredential> => {
  const pathToSignedVC = await input({
    message: 'Please enter the path to your document:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Document file path is required';
      }
      return true;
    },
  });

  const signedVC: SignedVerifiableCredential = readJsonFile(pathToSignedVC, 'document');

  return signedVC;
};

export const verify = async (signedVC: SignedVerifiableCredential, options: VerifyOptions = {}) => {
  const isOpenAttestation = isWrappedV2Document(signedVC) || isWrappedV3Document(signedVC);

  const { result, warnings } = isOpenAttestation
    ? { result: await verifyOpenAttestationDocument(signedVC, options), warnings: null }
    : await verifyW3CDocument(signedVC, options);

  if (warnings) {
    handleExpiredCredentialWarning(warnings);
  }

  logResultStatus(getResultFromFragment(FragmentType.DOCUMENT_INTEGRITY, result));
  logResultStatus(getResultFromFragment(FragmentType.DOCUMENT_STATUS, result));
  logResultStatus(getResultFromFragment(FragmentType.ISSUER_IDENTITY, result));

  const obligationStatus = getObligationDocumentStatus(result);
  if (obligationStatus) {
    const parts = [`registry=${obligationStatus.obligationRegistry}`];
    if (obligationStatus.status !== undefined) {
      parts.push(`status=${obligationStatus.status}`);
    }
    if (obligationStatus.terminationReason !== undefined) {
      parts.push(`terminationReason=${obligationStatus.terminationReason}`);
    }
    signale.info(`Obligation document status: ${parts.join(' ')}`);
  }
};

// ==== Helper Functions ====

/**
 * Resolve a network provider when document chain lookup fails.
 * Prefers --network, then interactive prompt on TTY, otherwise no provider.
 */
const resolveFallbackProvider = async (
  networkOverride?: string,
): Promise<V5Provider | undefined> => {
  if (networkOverride) {
    if (!Object.prototype.hasOwnProperty.call(supportedNetwork, networkOverride)) {
      throw new Error(
        `Unsupported network "${networkOverride}". Valid options: ${Object.keys(supportedNetwork).join(', ')}`,
      );
    }
    return getSupportedNetwork(networkOverride).provider() as unknown as V5Provider;
  }

  if (process.stdin.isTTY) {
    const networkName = await promptNetworkSelection();
    return getSupportedNetwork(networkName).provider() as unknown as V5Provider;
  }

  signale.warn(
    'No network could be resolved from the document and this session is non-interactive. Verifying without a provider. Pass --network to select one.',
  );
  return undefined;
};

const verifyW3CDocument = async (
  signedVC: SignedVerifiableCredential,
  options: VerifyOptions = {},
): Promise<{ result: VerificationFragment[]; warnings: unknown[][] }> => {
  signale.info('Verifying W3C document...');

  // To capture the console.warn from trustvc function
  const { result: isTransferable } = CaptureConsoleWarn(() => isTransferableRecord(signedVC));
  const isObligation = isObligationRecord(signedVC);
  const isRevokable = isDocumentRevokable(signedVC);
  const requiresNetwork = isTransferable || isObligation || isRevokable;

  if (isObligation) {
    signale.info('Verifying obligation / BoE document...');
  }

  // If the document is not transferable or revokable, verify directly
  // To capture the console.warn from trustvc function
  if (!requiresNetwork) return await CaptureConsoleWarnAsync(() => verifyDocument(signedVC));

  try {
    const chainId = getChainId(signedVC);
    const chainName = getSupportedNetworkNameFromId(Number(chainId));
    const network = getSupportedNetwork(chainName);
    const provider = network.provider() as unknown as V5Provider;
    if (provider) {
      return await CaptureConsoleWarnAsync(() => verifyDocument(signedVC, { provider }));
    }
  } catch (err: unknown) {
    signale.warn(`${err instanceof Error ? err.message : String(err)}`);
  }

  const provider = await resolveFallbackProvider(options.network);
  if (provider) {
    return await CaptureConsoleWarnAsync(() => verifyDocument(signedVC, { provider }));
  }

  // Fallback: Verify without provider
  return await CaptureConsoleWarnAsync(() => verifyDocument(signedVC));
};

const verifyOpenAttestationDocument = async (
  signedVC: WrappedOrSignedOpenAttestationDocument,
  options: VerifyOptions = {},
): Promise<VerificationFragment[]> => {
  signale.info('Verifying OpenAttestation document...');

  checkExpiration(signedVC);
  const requiresNetwork = isTransferableRecord(signedVC) || isDocumentRevokable(signedVC);

  // If the document is not transferable or revokable, verify directly
  if (!requiresNetwork) return await verifyDocument(signedVC);

  try {
    const chainId = getChainId(signedVC);
    if (chainId) {
      const chainName = getSupportedNetworkNameFromId(Number(chainId));
      const network = getSupportedNetwork(chainName);
      const provider = network.provider() as unknown as V5Provider;
      if (provider) return await verifyDocument(signedVC, { provider });
    }
  } catch (err: unknown) {
    signale.warn(`${err instanceof Error ? err.message : String(err)}`);
  }

  // Prefer --network / TTY prompt when chain lookup fails or returns no provider
  const provider = await resolveFallbackProvider(options.network);
  if (provider) return await verifyDocument(signedVC, { provider });

  // Fallback: Verify without provider only when no override can be resolved
  return await verifyDocument(signedVC);
};

const checkExpiration = (signedVC: WrappedOrSignedOpenAttestationDocument) => {
  const documentData = getDocumentData(signedVC);
  if (documentData.expirationDate && documentData.expirationDate < new Date().toISOString()) {
    signale.warn('The document credential has expired.');
  }
};

export const getResultFromFragment = (
  fragmentType: FragmentType,
  resultFragments: VerificationFragment[],
): VerificationFragmentWithData => {
  const candidates = resultFragments.filter(
    (fragment: VerificationFragment) =>
      fragment.type === fragmentType && fragment.status !== 'SKIPPED',
  );

  if (candidates.length === 0) {
    throw new Error(`${fragmentType} could not be verified.`);
  }

  const findByStatus = (status: string) =>
    candidates.find((fragment: VerificationFragment) => fragment.status === status);

  const preferred =
    findByStatus('VALID') || findByStatus('INVALID') || findByStatus('ERROR') || candidates[0];

  return preferred as VerificationFragmentWithData;
};

export const logResultStatus = (fragment: VerificationFragmentWithData): void => {
  if (fragment.status === 'VALID') {
    signale.success(`${fragment.type}: ${fragment.status}`);
  } else if (fragment.status === 'ERROR') {
    signale.error(`${fragment.type}: ${fragment.status} - An error has occurred.`);
  } else {
    const reasonMessage = (fragment as any)?.reason?.message;
    const message = reasonMessage ? reasonMessage : 'Verification failed.';
    signale.warn(`${fragment.type}: ${fragment.status} - ${message}`);
  }
};

// Temporary function to handle expired credential console.log from trustvc function for w2c verification
export const handleExpiredCredentialWarning = (warnings: unknown[][]) => {
  const expiredWarning = warnings.find((warning) => warning[0] === 'Credential has expired.');
  if (expiredWarning) {
    signale.warn(`The document credential has expired.`);
  }
};
