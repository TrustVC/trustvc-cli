import { input } from '@inquirer/prompts';
import { getSupportedNetwork, getSupportedNetworkNameFromId, readJsonFile, withAsyncCaptureConsoleWarn } from '../utils';
import { getChainId, getDocumentData, isWrappedV2Document, isWrappedV3Document, SignedVerifiableCredential, VerificationFragment, VerificationFragmentWithData, verifyDocument } from '@trustvc/trustvc';
import signale from 'signale';
import { getDefaultProvider } from 'ethers';

export const command = 'verify';
export const describe = 'Verify a document signed using w3c or OpenAttestation';

export const handler = async () => {
    try {
        const answers = await promptQuestions();
        if (!answers) return;

        await verify(answers);

    } catch (err: unknown) {
        signale.error(err instanceof Error ? err.message : String(err));
    }
}

export const promptQuestions = async (): Promise<SignedVerifiableCredential> => {
    const pathToSignedVC = await input({
        message: "Please enter the path to your signed Verifiable Credential file:",
        required: true,
        validate: (value: string) => {
            if (!value || value.trim() === '') {
                return 'signed Verifiable Credential file path is required';
            }
            return true;
        },
    });

    const signedVC: SignedVerifiableCredential = readJsonFile(pathToSignedVC, 'document');

    return signedVC;
}

export const verify = async (signedVC: SignedVerifiableCredential) => {
    const isOpenAttestationV2 = isWrappedV2Document(signedVC);
    const isOpenAttestationV3 = isWrappedV3Document(signedVC);
    const isW3C = !isOpenAttestationV2 && !isOpenAttestationV3;

    let result: VerificationFragment[];
    let warnings: unknown[][];

    if (isW3C) {
        signale.info('Verifying W3C document...');
        ({ result, warnings } = await withAsyncCaptureConsoleWarn(() => verifyDocument(signedVC)));
        handleExpiredCredentialWarning(warnings);
    } else {
        signale.info('Verifying OpenAttestation document...');
        const documentData = getDocumentData(signedVC);

        if (documentData.expirationDate && documentData.expirationDate < new Date().toISOString()) {
            signale.warn(`The Verifiable Credential has expired.`);
        }

        const chainId = Number(documentData.network?.chainId);
        const chainName = getSupportedNetworkNameFromId(chainId); 
        if (chainId) {
            result = await verifyDocument(signedVC, { provider: getSupportedNetwork(chainName).provider() });
        } else {
            result = await verifyDocument(signedVC);
        }
    }

    logResultStatus(getResultFromFragment('DOCUMENT_INTEGRITY', result));
    logResultStatus(getResultFromFragment('DOCUMENT_STATUS', result));
    logResultStatus(getResultFromFragment('ISSUER_IDENTITY', result));
}

// ==== Helper Functions ==== 


export const getResultFromFragment = (fragmentType: string, resultFragments: VerificationFragment[]): VerificationFragmentWithData => {
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

export const handleExpiredCredentialWarning = (warnings: unknown[][]) => {
    const expiredWarning = warnings.find((warning) => warning[0] === 'Credential has expired.');
    // currently not logging to align output for w3c (reports expiration) and openattestation (does not report expiration)
    if (expiredWarning) {
        signale.warn(`The Verifiable Credential has expired.`);
    }
}
