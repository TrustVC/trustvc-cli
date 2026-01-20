import { input } from "@inquirer/prompts";
import { getDocumentData } from "@trustvc/trustvc";
import { UnwrapOAInput } from "../../types";
import { documentsInDirectory, isDir, isDirectoryValid, isFile, readOpenAttestationFile, writeFile } from "../../utils";
import signale from "signale";
import path from "path";

export const command = 'oa-unwrap';
export const describe = 'Unwrap wrapped OpenAttestation document(s) (Only for individual documents)';

export const handler = async () => {
    try {
        const answer = await promptForInputs();
        if (!answer) return;

        await unwrapOA(answer);
    } catch (err: unknown) {
        signale.error(`${err instanceof Error ? err.message : String(err)}`);
    }
};

export const promptForInputs = async (): Promise<UnwrapOAInput> => {
    const pathToRawOA = await input({
        message: 'Please enter the path to your wrapped OpenAttestation document or directory:',
        required: true,
        validate: (value: string) => {
            if (!value || value.trim() === '') {
                return 'Wrapped OpenAttestation document path is required';
            }
            return true;
        },
    });

    const docPaths: string[] = [];
    if (await isFile(pathToRawOA)) {
        docPaths.push(pathToRawOA);
    } else if (await isDir(pathToRawOA)) {
        docPaths.push(...(await documentsInDirectory(pathToRawOA)));
        signale.info(`Found ${docPaths.length} document(s) to unwrap individually`);
    } else {
        throw new Error('The provided path is neither a valid file nor directory');
    }

    if (!docPaths.length) throw new Error('No OpenAttestation documents found in directory');

    const pathToOutputDirectory = await input({
        message: 'Please enter the directory to save the unwrapped OpenAttestation document(s) (optional):',
        required: false,
        default: '.',
    });

    if (!isDirectoryValid(pathToOutputDirectory)) throw new Error('Output path is not valid');

    return {
        docPaths,
        pathToOutputDirectory,
    };
};

export const unwrapOA = async ({
    docPaths,
    pathToOutputDirectory,
}: UnwrapOAInput) => {
    for (const doc of docPaths) {
        const wrappedOADocument = readOpenAttestationFile(doc);
        try {
            const unwrappedDocument = getDocumentData(wrappedOADocument);
            if (!unwrappedDocument) throw new Error('Invalid wrapped OpenAttestation document');
            const outFile = path.join(pathToOutputDirectory, path.basename(doc));
            writeFile(outFile, unwrappedDocument, true);
            signale.success(`Unwrapped OpenAttestation document: ${doc}`);
        } catch (err: unknown) {
            signale.error(`Error while unwrapping OpenAttestation document: ${doc}`);
        }
    }
};
