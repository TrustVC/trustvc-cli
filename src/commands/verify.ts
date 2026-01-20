import { input } from '@inquirer/prompts';
import {
    getSupportedNetwork,
    getSupportedNetworkNameFromId,
    readJsonFile,
    CaptureConsoleWarnAsync,
} from '../utils';
import {
    getChainId,
    getDocumentData,
    getTransferableRecordsCredentialStatus,
    isTransferableRecord,
    isWrappedV2Document,
    isWrappedV3Document,
    SignedVerifiableCredential,
    VerificationFragment,
    VerificationFragmentWithData,
    verifyDocument,
    WrappedOrSignedOpenAttestationDocument
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
        message: "Please enter the path to your document:",
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

    const { result, warnings } = isOpenAttestation
        ? { result: await verifyOpenAttestationDocument(signedVC), warnings: null }
        : await verifyW3CDocument(signedVC);

    if (warnings) {
        handleExpiredCredentialWarning(warnings);
    }

    logResultStatus(getResultFromFragment(FragmentType.DOCUMENT_INTEGRITY, result));
    logResultStatus(getResultFromFragment(FragmentType.DOCUMENT_STATUS, result));
    logResultStatus(getResultFromFragment(FragmentType.ISSUER_IDENTITY, result));
};

// ==== Helper Functions ==== 

const verifyW3CDocument = async (
    signedVC: SignedVerifiableCredential
): Promise<{ result: VerificationFragment[]; warnings: unknown[][] }> => {
    signale.info('Verifying W3C document...');

    // Non-transferable record: verify directly
    if (!isTransferableRecord(signedVC)) {
        return await CaptureConsoleWarnAsync(() => verifyDocument(signedVC));
    }

    const credentialStatus = getTransferableRecordsCredentialStatus(signedVC);
    const chainId = credentialStatus.tokenNetwork.chainId;

    if (chainId == null) {
        signale.error('Could not find blockchain information');
        throw new Error('Could not find blockchain information');
    }

    try {
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
    signedVC: WrappedOrSignedOpenAttestationDocument
): Promise<VerificationFragment[]> => {
    signale.info('Verifying OpenAttestation document...');
    // if chainId is defined, it is a TXT document, else DID document.
    checkExpiration(signedVC);
    try {
        const chainId = getChainId(signedVC);
        const chainName = getSupportedNetworkNameFromId(Number(chainId));
        const network = getSupportedNetwork(chainName);
        const provider = network.provider() as unknown as V5Provider;
        if (provider) {
            return await verifyDocument(signedVC, { provider });
        }
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

export const getResultFromFragment = (fragmentType: FragmentType, resultFragments: VerificationFragment[]): VerificationFragmentWithData => {
    const fragment = resultFragments.find((fragment: VerificationFragment) => fragment.type === fragmentType && fragment.status !== 'SKIPPED');
    if (!fragment) {
        throw new Error(`${fragmentType} could not be verified.`);
    }
    return fragment as VerificationFragmentWithData;
}

export const logResultStatus = (fragment: VerificationFragmentWithData): void => {
    if (fragment.status === 'VALID') {
        signale.success(`${fragment.type}: ${fragment.status}`);
    } else {
        signale.warn(`${fragment.type}: ${fragment.status} [${fragment.reason.message}]`);
    }
}

// Temporary function to handle expired credential console.log from trustvc function for w2c verification
export const handleExpiredCredentialWarning = (warnings: unknown[][]) => {
    const expiredWarning = warnings.find((warning) => warning[0] === 'Credential has expired.');
    if (expiredWarning) {
        signale.warn(`The document credential has expired.`);
    }
}
