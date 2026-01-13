import { input, select } from '@inquirer/prompts';
import { isDirectoryValid, readJsonFile, writeFile } from '../../utils';
import { issuer, RawVerifiableCredential, signW3C } from '@trustvc/trustvc';
import { SignInput } from '../../types';
import signale from 'signale';

export const command = 'w3c-sign';
export const describe = 'Sign a verifiable credential using a did key-pair file';

export const handler = async () => {
    try {
        const answers = await promptForInputs();
        if (!answers) return;

        await sign(answers);
    } catch (err: unknown) {
        signale.error(`${err instanceof Error ? err.message : String(err)}`);
    }
};

export const promptForInputs = async (): Promise<SignInput> => {
    const pathToKeypairFile = await input({
        message: 'Please enter the path to your did key-pair JSON file:',
        required: true,
        validate: (value: string) => {
            if (!value || value.trim() === '') {
                return 'did key-pair JSON file path is required';
            }
            return true;
        },
    });

    const keyPairData: typeof issuer.IssuedDIDOption = readJsonFile(pathToKeypairFile, 'key pair');

    const pathToCredentialFile = await input({
        message: 'Pleaae enter the path to your credential JSON file:',
        required: true,
        validate: (value: string) => {
            if (!value || value.trim() === '') {
                return 'Credential JSON file path is required';
            }
            return true;
        },
    });

    const credential: RawVerifiableCredential = readJsonFile(pathToCredentialFile, 'credential JSON');

    const encryptionAlgorithm = await select({
        message: 'Select the encryption algorithm used to generate the key pair:',
        choices: [
            { name: 'ECDSA-SD-2023', value: 'ecdsa-sd-2023', description: 'Sign credential using ECDSA-SD-2023 suite', },
            { name: 'BBS-2023', value: 'bbs-2023', description: 'Sign credential using BBS-2023 suite', },
        ],
        default: 'ECDSA-SD-2023',
    });

    const pathToSignedVC = await input({
        message: 'Enter a directory to save the signed verifiable credential (optional):',
        default: '.',
        required: false,
    });

    if (!isDirectoryValid(pathToSignedVC)) throw new Error('Output path is not valid');

    return {
        keyPairData,
        credential,
        encryptionAlgorithm,
        pathToSignedVC,
    };
};

export const sign = async ({
    keyPairData,
    credential,
    encryptionAlgorithm,
    pathToSignedVC,
}: SignInput): Promise<void> => {
    const signedVC = await signW3C(credential, keyPairData, encryptionAlgorithm);
    if (signedVC?.signed) {
        const signedVCPath = `${pathToSignedVC}/signed_vc.json`;
        writeFile(signedVCPath, signedVC.signed);
    } else {
        signale.error(signedVC.error);
    }
};