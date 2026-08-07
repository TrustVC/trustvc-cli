import { input } from '@inquirer/prompts';
import {
  getSupportedNetwork,
  getSupportedNetworkNameFromId,
  readJsonFile,
  CaptureConsoleWarnAsync,
  CaptureConsoleWarn,
  promptNetworkSelection,
  isVerifiablePresentation,
} from '../utils';
import {
  getChainId,
  getDocumentData,
  isDocumentRevokable,
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

export const command = 'verify';
export const describe = 'Verify a document signed using w3c or OpenAttestation';

export const handler = async () => {
  try {
    const signedVC = await promptQuestions();
    if (!signedVC) return;

    await verify(signedVC);
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

export const verify = async (signedVC: SignedVerifiableCredential) => {
  const isOpenAttestation = isWrappedV2Document(signedVC) || isWrappedV3Document(signedVC);
  const isPresentation = isVerifiablePresentation(signedVC);

  let result: VerificationFragment[];
  let warnings: unknown[][] | null = null;

  if (isPresentation) {
    result = await verifyPresentationDocument(signedVC);
  } else if (isOpenAttestation) {
    result = await verifyOpenAttestationDocument(signedVC);
  } else {
    ({ result, warnings } = await verifyW3CDocument(signedVC));
  }

  if (warnings) {
    handleExpiredCredentialWarning(warnings);
  }

  const fragments = [
    getResultFromFragment(FragmentType.DOCUMENT_INTEGRITY, result),
    getResultFromFragment(FragmentType.DOCUMENT_STATUS, result),
    getResultFromFragment(FragmentType.ISSUER_IDENTITY, result),
  ];
  fragments.forEach(logResultStatus);

  if (isPresentation && fragments.every((fragment) => fragment.status === 'VALID')) {
    logPresentationCredentialCount(fragments[0]);
  }
};

// ==== Helper Functions ====

/**
 * Verifies a Verifiable Presentation through the unified fragment pipeline: the holder
 * proof and holder binding (DOCUMENT_INTEGRITY), the presentation expiry and every
 * embedded credential's revocation (DOCUMENT_STATUS), and every embedded issuer
 * (ISSUER_IDENTITY). Freshness of an authentication proof (challenge / domain) is out of
 * scope — only the verifier that issued the challenge can check it.
 */
const verifyPresentationDocument = async (
  presentation: SignedVerifiableCredential,
): Promise<VerificationFragment[]> => {
  signale.info('Verifying W3C Verifiable Presentation...');

  return await verifyDocument(presentation);
};

const verifyW3CDocument = async (
  signedVC: SignedVerifiableCredential,
): Promise<{ result: VerificationFragment[]; warnings: unknown[][] }> => {
  signale.info('Verifying W3C document...');

  // To capture the console.warn from trustvc function
  const { result: isTransferable } = CaptureConsoleWarn(() => isTransferableRecord(signedVC));
  const isRevokable = isDocumentRevokable(signedVC);
  const requiresNetwork = isTransferable || isRevokable;

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

  // Fallback: Verify without provider
  return await CaptureConsoleWarnAsync(() => verifyDocument(signedVC));
};

const verifyOpenAttestationDocument = async (
  signedVC: WrappedOrSignedOpenAttestationDocument,
): Promise<VerificationFragment[]> => {
  signale.info('Verifying OpenAttestation document...');

  checkExpiration(signedVC);
  const requiresNetwork = isTransferableRecord(signedVC) || isDocumentRevokable(signedVC);
  const chainId = getChainId(signedVC);

  // If the document is not transferable or revokable, verify directly
  if (!requiresNetwork) return await verifyDocument(signedVC);

  // If chainId is not found, prompt for network selection
  if (requiresNetwork && !chainId) {
    const networkName = await promptNetworkSelection();
    const provider = getSupportedNetwork(networkName).provider() as unknown as V5Provider;
    if (provider) return await verifyDocument(signedVC, { provider });
  }

  try {
    const chainName = getSupportedNetworkNameFromId(Number(chainId));
    const network = getSupportedNetwork(chainName);
    const provider = network.provider() as unknown as V5Provider;
    if (provider) return await verifyDocument(signedVC, { provider });
  } catch (err: unknown) {
    signale.warn(`${err instanceof Error ? err.message : String(err)}`);
  }

  // Fallback: Verify without provider
  return await verifyDocument(signedVC);
};

const checkExpiration = (signedVC: WrappedOrSignedOpenAttestationDocument) => {
  const documentData = getDocumentData(signedVC);
  if (documentData.expirationDate && documentData.expirationDate < new Date().toISOString()) {
    signale.warn('The document credential has expired.');
  }
};

/**
 * How many credentials a valid presentation actually covered. The three aggregate lines read
 * identically whether one credential was checked or five, so state the count — it is the one
 * thing they cannot convey. Taken from the integrity fragment, which already verified each
 * embedded credential.
 */
export const logPresentationCredentialCount = (
  integrityFragment: VerificationFragmentWithData,
): void => {
  const credentialResults = (integrityFragment?.data as { credentialResults?: unknown[] })
    ?.credentialResults;
  if (!credentialResults?.length) return;
  const count = credentialResults.length;
  signale.info(`${count} embedded credential${count === 1 ? '' : 's'} verified.`);
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
