import signale from 'signale';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { getSupportedNetwork } from './networks';

const readdir = util.promisify(fs.readdir);

export const isFile = (path: fs.PathLike): boolean => {
  try {
    const stat = fs.lstatSync(path);
    return stat.isFile();
  } catch (_e) {
    return false;
  }
};

export const isDir = (path: fs.PathLike): boolean => {
  try {
    const stat = fs.lstatSync(path);
    return stat.isDirectory();
  } catch (_e) {
    return false;
  }
};

const validExtensions = /(.*)(\.)(opencerts?|json|jsonld|tt|oa)$/;

export const readFile = (filename: string): any => {
  return fs.readFileSync(filename, 'utf8');
};

export const readDocumentFile = (filename: string): any => {
  return JSON.parse(readFile(filename));
};

const isValidExtension = (filename: string): boolean =>
  validExtensions.test(filename.toLowerCase());

// this function return the list of path to the documents to process
// only documents with valid extension are returned (opencert, json, tt)
export const documentsInDirectory = async (documentPath: string): Promise<string[]> => {
  const items = isDir(documentPath)
    ? (await readdir(documentPath)).map((filename) => path.join(documentPath, filename))
    : [documentPath];
  return items.filter(isValidExtension);
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const writeDocumentToDisk = (
  destinationDir: string,
  filename: string,
  document: any,
): void => {
  // Resolve the destination directory and filename to get an absolute path
  const resolvedDestination = path.resolve(destinationDir);

  // Concatenate filename to the destination
  const safePath = path.join(resolvedDestination, filename);

  // Ensure the resolved path starts with the intended directory (destinationDir)
  if (!safePath.startsWith(resolvedDestination)) {
    throw new Error('Unsafe file path detected.');
  }

  // Write the document to the sanitized path
  fs.writeFileSync(safePath, JSON.stringify(document, null, 2));
};

export enum Output {
  File,
  Directory,
  StdOut,
}

export const writeOutput = ({
  outputPathType,
  documentPath,
  file,
  document,
}: {
  outputPathType: Output;
  documentPath?: string;
  file: string;
  document: any;
}): void => {
  if (outputPathType === Output.File && documentPath) {
    writeDocumentToDisk(path.parse(documentPath).dir, path.parse(documentPath).base, document);
  } else if (outputPathType === Output.Directory && documentPath) {
    writeDocumentToDisk(documentPath, path.parse(file).base, document);
  } else {
    console.log(JSON.stringify(document, undefined, 2)); // print to console, no file created
  }
};

export const writeFile = <T>(filePath: string, data: T, silent = false) => {
  try {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    if (!silent) {
      signale.success(`Saved: ${filePath}`);
    }
  } catch (_err) {
    throw new Error(`Unable to write file to ${filePath}`);
  }
};

// Read and parse JSON file
export const readJsonFile = <T>(filePath: string, fileType: string): T => {
  try {
    const data = fs.readFileSync(filePath, { encoding: 'utf8' });
    return JSON.parse(data) as T;
  } catch (_err) {
    throw new Error(`Invalid ${fileType} file path: ${filePath}`);
  }
};

// Validate if the directory exists
export const isDirectoryValid = (path: string): boolean => {
  try {
    fs.readdirSync(path, { encoding: 'utf-8' });
    return true;
  } catch (_err) {
    signale.warn(`Invalid directory path: ${path}`);
    return false;
  }
};

export const getEtherscanAddress = ({ network }: { network: string }): string =>
  getSupportedNetwork(network).explorer;
