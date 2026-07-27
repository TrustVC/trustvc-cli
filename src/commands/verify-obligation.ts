import { input } from '@inquirer/prompts';
import {
  getChainId,
  getObligationDocumentStatus,
  isObligationRecord,
  isWrappedV2Document,
  isWrappedV3Document,
  SignedVerifiableCredential,
  SUPPORTED_CHAINS,
  CHAIN_ID,
  VerificationFragment,
  verifyObligationDocument,
} from '@trustvc/trustvc';
import signale from 'signale';
import {
  CaptureConsoleWarnAsync,
  getSupportedNetworkNameFromId,
  promptNetworkSelection,
  readJsonFile,
  supportedNetwork,
  NetworkCmdName,
} from '../utils';
import { FragmentType } from '../types';
import { getResultFromFragment, handleExpiredCredentialWarning, logResultStatus } from './verify';

export const command = 'verify-obligation';
export const describe =
  'Verify a BoE / obligation document via the obligation verify pipeline (not classic verify)';

export const handler = async () => {
  try {
    const signedVC = await promptQuestions();
    if (!signedVC) return;
    await verifyObligation(signedVC);
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
  }
};

export const promptQuestions = async (): Promise<SignedVerifiableCredential> => {
  const pathToSignedVC = await input({
    message: 'Please enter the path to your obligation / BoE document:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Document file path is required';
      }
      return true;
    },
  });
  return readJsonFile(pathToSignedVC, 'document');
};

export const verifyObligation = async (signedVC: SignedVerifiableCredential) => {
  const isOpenAttestation = isWrappedV2Document(signedVC) || isWrappedV3Document(signedVC);
  if (isOpenAttestation) {
    signale.error(
      'OpenAttestation documents are not supported by verify-obligation. Use classic `trustvc verify`.',
    );
    return;
  }

  if (!isObligationRecord(signedVC)) {
    signale.warn(
      'Document does not look like an obligation record (missing obligationRegistry). Continuing with obligation pipeline anyway.',
    );
  }

  signale.info('Verifying obligation / BoE document...');
  const { result, warnings } = await verifyObligationW3C(signedVC);
  if (warnings) {
    handleExpiredCredentialWarning(warnings);
  }

  logResultStatus(getResultFromFragment(FragmentType.DOCUMENT_INTEGRITY, result));
  logResultStatus(getResultFromFragment(FragmentType.DOCUMENT_STATUS, result));
  logResultStatus(getResultFromFragment(FragmentType.ISSUER_IDENTITY, result));

  const obligationStatus = getObligationDocumentStatus(result);
  if (obligationStatus) {
    signale.info(
      `Obligation document status: registry=${obligationStatus.obligationRegistry} status=${obligationStatus.status} terminationReason=${obligationStatus.terminationReason}`,
    );
  }
};

const resolveRpcUrl = (networkName: string): string | undefined => {
  const chain = Object.values(SUPPORTED_CHAINS).find((c) => c.name === networkName);
  return (chain as { rpcUrl?: string } | undefined)?.rpcUrl;
};

const verifyObligationW3C = async (
  signedVC: SignedVerifiableCredential,
): Promise<{ result: VerificationFragment[]; warnings: unknown[][] }> => {
  const run = async (rpcProviderUrl?: string) => {
    const { fragments } = await verifyObligationDocument(
      signedVC,
      rpcProviderUrl ? { rpcProviderUrl } : {},
    );
    return fragments;
  };

  try {
    const chainId = getChainId(signedVC) as CHAIN_ID | undefined;
    if (chainId !== undefined && chainId !== null) {
      const chainName = getSupportedNetworkNameFromId(Number(chainId));
      const rpcProviderUrl =
        resolveRpcUrl(chainName) ?? resolveRpcUrl(SUPPORTED_CHAINS[chainId]?.name);
      if (rpcProviderUrl) {
        return await CaptureConsoleWarnAsync(() => run(rpcProviderUrl));
      }
      // Fall back to public URLs for common testnets when SUPPORTED_CHAINS has no rpcUrl
      const fallback: Partial<Record<NetworkCmdName, string>> = {
        [NetworkCmdName.Amoy]: 'https://rpc-amoy.polygon.technology',
        [NetworkCmdName.Sepolia]: 'https://rpc.sepolia.org',
        [NetworkCmdName.Local]: 'http://127.0.0.1:8545',
      };
      const cmdName = Object.entries(supportedNetwork).find(
        ([, v]) => v.networkName === chainName || v.networkId === Number(chainId),
      )?.[0] as NetworkCmdName | undefined;
      if (cmdName && fallback[cmdName]) {
        return await CaptureConsoleWarnAsync(() => run(fallback[cmdName]));
      }
    }
  } catch (err: unknown) {
    signale.warn(`${err instanceof Error ? err.message : String(err)}`);
  }

  const networkName = await promptNetworkSelection();
  const rpcProviderUrl =
    resolveRpcUrl(networkName) ??
    (networkName === NetworkCmdName.Amoy
      ? 'https://rpc-amoy.polygon.technology'
      : networkName === NetworkCmdName.Sepolia
        ? 'https://rpc.sepolia.org'
        : undefined);

  return await CaptureConsoleWarnAsync(() => run(rpcProviderUrl));
};
