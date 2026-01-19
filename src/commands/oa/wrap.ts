import { input, select } from "@inquirer/prompts";
import { documentsInDirectory, isDir, isDirectoryValid, isFile, readOpenAttestationFile, writeFile } from "../../utils";
import { OpenAttestationDocument, wrapOADocument, wrapOADocuments, WrappedOrSignedOpenAttestationDocument } from "@trustvc/trustvc";
import signale from "signale";
import path from "path";
import { WrapMode, WrapOAInput } from "../../types";

export const command = 'oa-wrap';
export const describe = 'Wrap OpenAttestation document(s)';

export const handler = async () => {
    try {
        const answer = await promptForInputs();
        if (!answer) return;

        await wrapOA(answer);
    } catch (err: unknown) {
        signale.error(`${err instanceof Error ? err.message : String(err)}`);
    }
};

export const promptForInputs = async (): Promise<WrapOAInput> => {

    let mode = await select<WrapMode>({
        message: "Do you want to wrap OpenAttestation documents individually or as a batch?",
        choices: [
            { name: 'Individually', value: WrapMode.Individual },
            { name: 'Batch', value: WrapMode.Batch },
        ],
    });

    const pathToRawOA = await input({
        message: mode === WrapMode.Batch
            ? 'Please enter the path to your OpenAttestation documents directory:'
            : 'Please enter the path to your OpenAttestation document or directory:',
        required: true,
        validate: (value: string) => {
            if (!value || value.trim() === '') {
                return 'OpenAttestation document path is required';
            }
            return true;
        },
    });

    const docPaths: string[] = [];

    if (mode === WrapMode.Batch) {
        if (!(await isDir(pathToRawOA))) {
            throw new Error('The provided directory is not valid');
        }
        docPaths.push(...(await documentsInDirectory(pathToRawOA)));
        if (docPaths.length === 1) {
            signale.info(`Found 1 document: batch mode deactivated`);
            mode = WrapMode.Individual;
        } else {
            signale.info(`Found ${docPaths.length} document(s) to batch wrap`);
        }
    } else {
        if (await isFile(pathToRawOA)) {
            docPaths.push(pathToRawOA);
        } else if (await isDir(pathToRawOA)) {
            docPaths.push(...(await documentsInDirectory(pathToRawOA)));
            signale.info(`Found ${docPaths.length} document(s) to wrap individually`);
        } else {
            throw new Error('The provided path is neither a valid file nor directory');
        }
    }

    if (!docPaths.length) throw new Error('No OpenAttestation documents found in directory');

    const pathToOutputDirectory = await input({
        message: 'Please enter the directory to save the wrapped OpenAttestation document (optional):',
        required: false,
        default: '.',
    })

    if (!isDirectoryValid(pathToOutputDirectory)) throw new Error('Output Directory is not valid');

    return {
        mode,
        docPaths,
        pathToOutputDirectory,
    };
};

export const wrapOA = async ({
    mode,
    docPaths,
    pathToOutputDirectory,
}: WrapOAInput) => {
    if (mode === WrapMode.Batch) {
        const oaDocs: OpenAttestationDocument[] = docPaths.map((doc) => readOpenAttestationFile(doc));
        const wrappedDocuments = await wrapOADocuments(oaDocs);
        signale.success('OpenAttestation document batch successfully wrapped');

        const pathToOutputFile = path.join(pathToOutputDirectory, "batchwrapped_oa_docs.json");
        writeFile(pathToOutputFile, wrappedDocuments, true);
        signale.success(`Wrapped OpenAttestation document batch saved to: ${pathToOutputFile}`);
        return;
    } else {
        const wrappedDocs: Record<string, WrappedOrSignedOpenAttestationDocument> = {};
        for (const doc of docPaths) {
            const oaDoc: OpenAttestationDocument = readOpenAttestationFile(doc);
            const wrappedDoc = await wrapOADocument(oaDoc);
            const outFile = path.join(pathToOutputDirectory, path.basename(doc));
            wrappedDocs[outFile] = wrappedDoc;
        }
        // Only save wrapped documents if all documents are valid
        for (const [outFile, wrappedDoc] of Object.entries(wrappedDocs)) {
            writeFile(outFile, wrappedDoc, true);
        }

        signale.success(`OpenAttestation ${docPaths.length > 1 ? 'documents' : 'document'} successfully wrapped`);
        signale.success(`Wrapped OpenAttestation ${docPaths.length > 1 ? 'documents' : 'document'} saved to: ${pathToOutputDirectory}`);
        return;
    }
};