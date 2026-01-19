import { input, select } from "@inquirer/prompts";
import { documentsInDirectory, isDir, isDirectoryValid, isFile, readOpenAttestationFile, writeFile } from "../../utils";
import { OpenAttestationDocument, wrapOADocument, wrapOADocuments, WrappedOrSignedOpenAttestationDocument } from "@trustvc/trustvc";
import signale from "signale";
import path from "path";
import { WrapMode, WrapOAInput } from "../../types";
import { mkdirSync } from "fs";

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

    if (!isDir(pathToOutputDirectory)) {
        signale.info(`Directory not found; Creating new directory: ${pathToOutputDirectory}`);
        mkdirSync(pathToOutputDirectory, { recursive: true });
    }

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
    const docData = docPaths.map((docPath) => ({
        path: docPath,
        fileName: path.basename(docPath),
        document: readOpenAttestationFile(docPath),
    }));

    if (mode === WrapMode.Batch) {
        const wrappedDocuments = await wrapOADocuments(docData.map(d => d.document));

        const results = docData.map((data, index) => ({
            ...data,
            wrappedDocument: wrappedDocuments[index],
        }));

        results.forEach(({ fileName, wrappedDocument }) => {
            const outFile = path.join(pathToOutputDirectory, `${fileName}`);
            writeFile(outFile, wrappedDocument, true);
            signale.success(`Wrapped OpenAttestation document: ${outFile}`);
        });

        signale.success('All documents wrapped in batch mode');
    } else {
        for (const data of docData) {
            try {
                const wrappedDocument = await wrapOADocument(data.document);
                const outFile = path.join(pathToOutputDirectory, `${data.fileName}`);
                writeFile(outFile, wrappedDocument, true);
                signale.success(`Wrapped OpenAttestation document: ${outFile}`);
            } catch (err: unknown) {
                signale.error(`Error while wrapping OpenAttestation document: ${data.path}`);
                if (err instanceof Error) {
                    signale.error(err.message);
                }
            }
        }

        signale.success('All documents wrapped in individual mode');
    }
};