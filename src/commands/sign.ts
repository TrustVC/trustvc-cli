import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { isDirectoryValid, readJsonFile } from '../utils';
import { issuer, RawVerifiableCredential, signW3C } from '@trustvc/trustvc';
import { writeFile } from '../utils/file-io';
import { CryptoSuiteName } from '@trustvc/w3c-vc';

export const command = 'w3c-sign';
export const describe = 'Sign a document using a key pair file';

export const handler = async () => {
    try {
        const answers = await promptForInputs();
        if (!answers) return;

        await sign(answers);
    } catch (err: unknown) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
};

export const promptForInputs = async (): Promise<SignCommand> => {
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

    const encryptionAlgorithm = await select({
        message: 'Select the supported encryption algorithms',
        choices: [
            { name: 'ECDSA-SD-2023', value: 'ecdsa-sd-2023', description: 'Sign credential using ECDSA-SD-2023 suite', },
            { name: 'BBS-2023', value: 'bbs-2023', description: 'Sign credential using BBS-2023 suite', },
            { name: 'ECDSA', value: 'ecdsa', description: 'Sign credential using ECDSA suite', },
            { name: 'BBS', value: 'bbs', description: 'Sign credential using BBS suite', },
        ],
        default: 'ECDSA-SD-2023',
    });

    const pathToSignedVC = await input({
        message: 'Enter a file path to save the signed verifiable credential (default: current directory):',
        default: '.',
        required: true,
    });

    return {
        pathToKeypairFile,
        pathToCredentialFile,
        encryptionAlgorithm,
        pathToSignedVC,
    };
};

// === Implementation ===

type SignCommand = {
    pathToKeypairFile: string;
    pathToCredentialFile: string;
    encryptionAlgorithm: string;
    pathToSignedVC: string;
};

export const sign = async ({
    pathToKeypairFile,
    pathToCredentialFile,
    encryptionAlgorithm,
    pathToSignedVC,
}: SignCommand): Promise<void> => {
    console.log(pathToCredentialFile);
    const keypairData: typeof issuer.IssuedDIDOption = readJsonFile(pathToKeypairFile, 'key pair');
    const credential = readJsonFile(pathToCredentialFile, 'credential JSON') as RawVerifiableCredential; // This does not give informative error for wrongly formatted JSON
    const algorithm = encryptionAlgorithm as CryptoSuiteName;
    try {
        const signedVC = await signW3C(credential, keypairData, algorithm);
        console.log(signedVC.signed); 
        writeFile(pathToSignedVC, signedVC.signed);
    } catch (err: unknown) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    }
};