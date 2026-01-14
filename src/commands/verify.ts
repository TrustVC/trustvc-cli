import { input } from '@inquirer/prompts';
import { readJsonFile, withAsyncCaptureConsoleWarn } from '../utils';
import { SignedVerifiableCredential, VerificationFragment, VerificationFragmentWithData, verifyDocument } from '@trustvc/trustvc';
import signale from 'signale';

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
    const { result, warnings } = await withAsyncCaptureConsoleWarn(() => verifyDocument(signedVC));
    logExpiredCredentialWarning(warnings);

    logResultStatus(getResultFromFragment('DOCUMENT_INTEGRITY', result));
    logResultStatus(getResultFromFragment('DOCUMENT_STATUS', result));
    logResultStatus(getResultFromFragment('ISSUER_IDENTITY', result));
}

// ==== Helper Functions ==== 


const getResultFromFragment = (fragmentType: string, resultFragments: VerificationFragment[]): VerificationFragmentWithData => {
    const fragment = resultFragments.find((fragment: VerificationFragment) => fragment.type === fragmentType && fragment.status !== 'SKIPPED');
    if (!fragment) {
        throw new Error(`${fragmentType} could not be verified.`);
    }
    return fragment as VerificationFragmentWithData;
}

const logResultStatus = (fragment: VerificationFragmentWithData): void => {
    if (fragment.status === 'VALID') {
        signale.success(`${fragment.type}: ${fragment.status}`);
    } else {
        signale.warn(`${fragment.type}: ${fragment.status} [${fragment.reason.message}]`);
    }
}

// currently not logging to align outputs for w3c and openattestation
const logExpiredCredentialWarning = (warnings: unknown[][]) => {
    const expiredWarning = warnings.find((warning) => warning[0] === 'Credential has expired.');
    if (expiredWarning) {
        // signale.warn(`The Verifiable Credential has expired.`);
    }
}
