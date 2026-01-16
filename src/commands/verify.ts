import { input } from '@inquirer/prompts';
import {
    getSupportedNetwork,
    getSupportedNetworkNameFromId,
    readJsonFile,
    withAsyncCaptureConsoleWarn
} from '../utils';
import {
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
    const isOpenAttestationV2 = isWrappedV2Document(signedVC);
    const isOpenAttestationV3 = isWrappedV3Document(signedVC);
    const isW3C = !isOpenAttestationV2 && !isOpenAttestationV3;

    let result: VerificationFragment[];
    let warnings: unknown[][] | undefined;

    if (isW3C) {
        ({ result, warnings } = await verifyW3CDocument(signedVC));
    } else {
        result = await verifyOpenAttestationDocument(signedVC);
    }

    if (warnings) {
        handleExpiredCredentialWarning(warnings);
    }

    logResultStatus(getResultFromFragment('DOCUMENT_INTEGRITY', result));
    logResultStatus(getResultFromFragment('DOCUMENT_STATUS', result));
    logResultStatus(getResultFromFragment('ISSUER_IDENTITY', result));
};

// ==== Helper Functions ==== 

type FragmentType = 'DOCUMENT_INTEGRITY' | 'DOCUMENT_STATUS' | 'ISSUER_IDENTITY';

const resolveProviderForChainId = (chainId: number): V5Provider => {
    const chainName = getSupportedNetworkNameFromId(chainId);
    const provider = getSupportedNetwork(chainName).provider();
    return provider as unknown as V5Provider;
};

const verifyW3CDocument = async (
    signedVC: SignedVerifiableCredential
): Promise<{ result: VerificationFragment[]; warnings: unknown[][] }> => {
    signale.info('Verifying W3C document...');
    if (isTransferableRecord(signedVC)) {
        const credentialStatus = getTransferableRecordsCredentialStatus(signedVC);        

        if (credentialStatus.tokenNetwork.chainId != null) {
            const chainId = Number(credentialStatus.tokenNetwork.chainId);
            const providerForTrustVC = resolveProviderForChainId(chainId);
            return await withAsyncCaptureConsoleWarn(() => verifyDocument(signedVC, { provider: providerForTrustVC }));
        } else {
            signale.error('Could not find blockchain information');
            throw new Error('Could not find blockchain information');
        }
    } else {
        return await withAsyncCaptureConsoleWarn(() => verifyDocument(signedVC));
    }
};

const verifyOpenAttestationDocument = async (
    signedVC: WrappedOrSignedOpenAttestationDocument
): Promise<VerificationFragment[]> => {
    signale.info('Verifying OpenAttestation document...');
    const documentData = getDocumentData(signedVC);

    if (documentData.expirationDate && documentData.expirationDate < new Date().toISOString()) {
        signale.warn(`The document credential has expired.`);
    }

    if (documentData.network?.chainId != null) {
        const chainId = Number(documentData.network?.chainId);
        const providerForTrustVC = resolveProviderForChainId(chainId);
        return await verifyDocument(signedVC, { provider: providerForTrustVC });
    } else {
        signale.error('Could not find blockchain information');
        throw new Error('Could not find blockchain information');
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
