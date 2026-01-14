import { input } from '@inquirer/prompts';
import { readJsonFile } from '../utils';
import { SignedVerifiableCredential, VerificationFragment, VerificationFragmentWithData, verifyDocument } from '@trustvc/trustvc';
import signale from 'signale';

const isFragmentWithData = (fragment: VerificationFragment): fragment is VerificationFragmentWithData => fragment.status !== 'SKIPPED';

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

export const promptQuestions = async (): Promise<{ signedVC: SignedVerifiableCredential }> => {
    const pathToSignedVC = await input({
        message: "Please enter the path to your signed credential file:",
        required: true,
        validate: (value: string) => {
            if (!value || value.trim() === '') {
                return 'signed credential file path is required';
            }
            return true;
        },
    });

    const signedVC: SignedVerifiableCredential = readJsonFile(pathToSignedVC, 'document');

    return {
        signedVC,
    }
}

export const verify = async ({ signedVC }: { signedVC: SignedVerifiableCredential }) => {
    const resultFragments = await verifyDocument(signedVC); // This function will handle both w3c and OA verification
    const relevantTypes = new Set(['DOCUMENT_INTEGRITY', 'DOCUMENT_STATUS', 'ISSUER_IDENTITY']);
    console.log(resultFragments);
    const nonSkipped = (resultFragments as VerificationFragment[])
        .filter((fragment: VerificationFragment) => relevantTypes.has(fragment.type))
        .filter(isFragmentWithData);

    if (nonSkipped.length === 0) {
        signale.info('No results for DOCUMENT_INTEGRITY, DOCUMENT_STATUS, or ISSUER_IDENTITY.');
        return;
    }

    for (const fragment of nonSkipped) {
        if (fragment.status === 'VALID') {
            signale.success(`${fragment.type}: ${fragment.status}`);
        } else {
            signale.warn(`${fragment.type}: ${fragment.status} [${fragment.reason.message}]`);
        }
    }
}
