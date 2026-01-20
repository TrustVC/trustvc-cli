import * as prompts from '@inquirer/prompts';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { WrapMode } from '../../../src/types';
import { promptForInputs, wrapOA } from '../../../src/commands/oa/wrap';

vi.mock('@inquirer/prompts');

vi.mock('signale', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
  Signale: vi.fn().mockImplementation(() => ({
    await: vi.fn(),
    success: vi.fn(),
  })),
}));

vi.mock('../../../src/utils', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
  return {
    ...actual,
    documentsInDirectory: vi.fn(),
    isDir: vi.fn(),
    isDirectoryValid: vi.fn(),
    isFile: vi.fn(),
    readOpenAttestationFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    wrapOADocument: vi.fn(),
    wrapOADocuments: vi.fn(),
  };
});

describe('oa-wrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForInputs', () => {
    it('should return parsed inputs in batch mode when directory is valid and contains multiple documents', async () => {
      (prompts.select as any).mockResolvedValueOnce(WrapMode.Batch);
      (prompts.input as any).mockResolvedValueOnce('./docs').mockResolvedValueOnce('./out');

      const utils = await import('../../../src/utils');
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);
      (utils.documentsInDirectory as MockedFunction<any>).mockResolvedValue([
        './docs/a.json',
        './docs/b.json',
      ]);

      const result = await promptForInputs();

      expect(result).toStrictEqual({
        mode: WrapMode.Batch,
        docPaths: ['./docs/a.json', './docs/b.json'],
        pathToOutputDirectory: './out',
      });
    });

    it('should deactivate batch mode when only 1 document is found', async () => {
      (prompts.select as any).mockResolvedValueOnce(WrapMode.Batch);
      (prompts.input as any).mockResolvedValueOnce('./docs').mockResolvedValueOnce('.');

      const utils = await import('../../../src/utils');
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);
      (utils.documentsInDirectory as MockedFunction<any>).mockResolvedValue(['./docs/only.json']);

      const signale = await import('signale');
      const infoMock = (signale.default as any).info as MockedFunction<any>;

      const result = await promptForInputs();

      expect(result.mode).toBe(WrapMode.Individual);
      expect(result.docPaths).toEqual(['./docs/only.json']);
      expect(infoMock).toHaveBeenCalledWith('Found 1 document: batch mode deactivated');
    });

    it('should throw error when batch mode is selected and directory is invalid', async () => {
      (prompts.select as any).mockResolvedValueOnce(WrapMode.Batch);
      (prompts.input as any).mockResolvedValueOnce('./not-a-dir');

      const utils = await import('../../../src/utils');
      (utils.isDir as MockedFunction<any>).mockReturnValue(false);

      await expect(promptForInputs()).rejects.toThrow('The provided directory is not valid');
    });

    it('should accept a single file path in individual mode', async () => {
      (prompts.select as any).mockResolvedValueOnce(WrapMode.Individual);
      (prompts.input as any).mockResolvedValueOnce('./doc.json').mockResolvedValueOnce('.');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      const result = await promptForInputs();

      expect(result).toStrictEqual({
        mode: WrapMode.Individual,
        docPaths: ['./doc.json'],
        pathToOutputDirectory: '.',
      });
    });

    it('should accept a directory in individual mode and wrap documents individually', async () => {
      (prompts.select as any).mockResolvedValueOnce(WrapMode.Individual);
      (prompts.input as any).mockResolvedValueOnce('./docs').mockResolvedValueOnce('.');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(false);
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);
      (utils.documentsInDirectory as MockedFunction<any>).mockResolvedValue([
        './docs/a.json',
        './docs/b.json',
      ]);

      const signale = await import('signale');
      const infoMock = (signale.default as any).info as MockedFunction<any>;

      const result = await promptForInputs();

      expect(result.docPaths).toEqual(['./docs/a.json', './docs/b.json']);
      expect(infoMock).toHaveBeenCalledWith('Found 2 document(s) to wrap individually');
    });

    it('should throw error when provided path is neither a valid file nor directory in individual mode', async () => {
      (prompts.select as any).mockResolvedValueOnce(WrapMode.Individual);
      (prompts.input as any).mockResolvedValueOnce('./invalid');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(false);
      (utils.isDir as MockedFunction<any>).mockReturnValue(false);

      await expect(promptForInputs()).rejects.toThrow(
        'The provided path is neither a valid file nor directory',
      );
    });

    it('should throw error when no OpenAttestation documents are found', async () => {
      (prompts.select as any).mockResolvedValueOnce(WrapMode.Individual);
      (prompts.input as any).mockResolvedValueOnce('./docs');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(false);
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);
      (utils.documentsInDirectory as MockedFunction<any>).mockResolvedValue([]);

      await expect(promptForInputs()).rejects.toThrow('No OpenAttestation documents found in directory');
    });

    it('should abide by validation rules for raw document path input', async () => {
      (prompts.select as any).mockResolvedValueOnce(WrapMode.Individual);
      (prompts.input as any).mockResolvedValueOnce('./doc.json').mockResolvedValueOnce('.');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      await promptForInputs();

      const [rawPathArgs] = (prompts.input as any).mock.calls.map((c: any[]) => c[0]);
      expect(rawPathArgs.required).toBe(true);
      expect(rawPathArgs.validate('')).toBe('OpenAttestation document path is required');
      expect(rawPathArgs.validate('   ')).toBe('OpenAttestation document path is required');
      expect(rawPathArgs.validate('./doc.json')).toBe(true);
    });

    it('should prompt with correct mode selection choices', async () => {
      (prompts.select as any).mockResolvedValueOnce(WrapMode.Individual);
      (prompts.input as any).mockResolvedValueOnce('./doc.json').mockResolvedValueOnce('.');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      await promptForInputs();

      const selectArgs = (prompts.select as any).mock.calls[0][0];
      expect(selectArgs.message).toContain('wrap OpenAttestation documents');
      expect(selectArgs.choices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: WrapMode.Individual }),
          expect.objectContaining({ value: WrapMode.Batch }),
        ]),
      );
    });

    it('should throw error when output directory is invalid', async () => {
      (prompts.select as any).mockResolvedValueOnce(WrapMode.Individual);
      (prompts.input as any).mockResolvedValueOnce('./doc.json').mockResolvedValueOnce('./bad-out');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(false);

      await expect(promptForInputs()).rejects.toThrow('Output path is not valid');
    });
  });

  describe('wrapOA', () => {
    it('should wrap documents individually and continue when one document fails', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const wrapOADocumentMock = trustvc.wrapOADocument as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;

      readMock.mockReturnValueOnce({ raw: 1 }).mockReturnValueOnce({ raw: 2 });
      wrapOADocumentMock
        .mockResolvedValueOnce({ wrapped: 1 })
        .mockRejectedValueOnce(new Error('wrap failed'));

      await wrapOA({
        mode: WrapMode.Individual,
        docPaths: ['./docs/a.json', './docs/b.json'],
        pathToOutputDirectory: './out',
      });

      expect(wrapOADocumentMock).toHaveBeenCalledTimes(2);
      expect(writeMock).toHaveBeenCalledTimes(1);
      expect(writeMock).toHaveBeenCalledWith('out/a.json', { wrapped: 1 }, true);

      expect(errorMock).toHaveBeenCalledWith('Error while wrapping OpenAttestation document: ./docs/b.json');
      expect(errorMock).toHaveBeenCalledWith('wrap failed');

      expect(successMock).toHaveBeenCalledWith('Wrapped OpenAttestation document: out/a.json');
      expect(successMock).toHaveBeenCalledWith('All documents wrapped in individual mode');
    });
  });

  describe('testing with OA v2 fixtures', () => {
    const RAW_OA_V2_DID_FILE = 'tests/fixtures/wrap/oa_v2/raw_oa_docs_v2/raw-did.json';
    const RAW_OA_V2_TXT_FILE = 'tests/fixtures/wrap/oa_v2/raw_oa_docs_v2/raw-txt.json';

    it('should wrap documents in batch mode with deterministic proof properties', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const actualUtils = await vi.importActual<typeof import('../../../src/utils')>(
        '../../../src/utils',
      );
      const actualTrustvc = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const wrapOADocumentsMock = trustvc.wrapOADocuments as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;

      readMock.mockImplementation(actualUtils.readOpenAttestationFile as unknown as any);
      wrapOADocumentsMock.mockImplementation(actualTrustvc.wrapOADocuments as unknown as any);

      const originalDidData = actualUtils.readOpenAttestationFile(RAW_OA_V2_DID_FILE);
      const originalTxtData = actualUtils.readOpenAttestationFile(RAW_OA_V2_TXT_FILE);

      await wrapOA({
        mode: WrapMode.Batch,
        docPaths: [RAW_OA_V2_DID_FILE, RAW_OA_V2_TXT_FILE],
        pathToOutputDirectory: './out',
      });

      expect(wrapOADocumentsMock).toHaveBeenCalledTimes(1);
      expect(wrapOADocumentsMock.mock.calls[0][0]).toHaveLength(2);

      const didCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-did.json');
      const txtCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-txt.json');
      expect(didCall).toBeTruthy();
      expect(txtCall).toBeTruthy();

      const file1 = didCall![1] as any;
      const file2 = txtCall![1] as any;
      const proof1 = file1.signature;
      const proof2 = file2.signature;

      const merkleRoot = proof1.merkleRoot as string;
      expect(merkleRoot).toHaveLength(64);
      expect(merkleRoot).toStrictEqual(proof2.merkleRoot);
      expect(merkleRoot).not.toStrictEqual(proof1.targetHash);
      expect(merkleRoot).not.toStrictEqual(proof2.targetHash);
      expect(proof1.targetHash).not.toStrictEqual(proof2.targetHash);

      expect(actualTrustvc.getDocumentData(file1)).toStrictEqual(originalDidData);
      expect(actualTrustvc.getDocumentData(file2)).toStrictEqual(originalTxtData);

      expect(successMock).toHaveBeenCalledWith('Wrapped OpenAttestation document: out/raw-did.json');
      expect(successMock).toHaveBeenCalledWith('Wrapped OpenAttestation document: out/raw-txt.json');
      expect(successMock).toHaveBeenCalledWith('All documents wrapped in batch mode');
    });

    it('should wrap documents in individual mode with merkleRoot equal to targetHash', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const actualUtils = await vi.importActual<typeof import('../../../src/utils')>(
        '../../../src/utils',
      );
      const actualTrustvc = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const wrapOADocumentMock = trustvc.wrapOADocument as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;

      readMock.mockImplementation(actualUtils.readOpenAttestationFile as unknown as any);
      wrapOADocumentMock.mockImplementation(actualTrustvc.wrapOADocument as unknown as any);

      const originalDidData = actualUtils.readOpenAttestationFile(RAW_OA_V2_DID_FILE);
      const originalTxtData = actualUtils.readOpenAttestationFile(RAW_OA_V2_TXT_FILE);

      await wrapOA({
        mode: WrapMode.Individual,
        docPaths: [RAW_OA_V2_DID_FILE, RAW_OA_V2_TXT_FILE],
        pathToOutputDirectory: './out',
      });

      expect(wrapOADocumentMock).toHaveBeenCalledTimes(2);

      const didCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-did.json');
      const txtCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-txt.json');
      expect(didCall).toBeTruthy();
      expect(txtCall).toBeTruthy();

      const file1 = didCall![1] as any;
      const file2 = txtCall![1] as any;
      const proof1 = file1.signature;
      const proof2 = file2.signature;

      expect(proof1.merkleRoot).toHaveLength(64);
      expect(proof2.merkleRoot).toHaveLength(64);
      expect(proof1.merkleRoot).toStrictEqual(proof1.targetHash);
      expect(proof2.merkleRoot).toStrictEqual(proof2.targetHash);
      expect(proof1.targetHash).not.toStrictEqual(proof2.targetHash);

      expect(actualTrustvc.getDocumentData(file1)).toStrictEqual(originalDidData);
      expect(actualTrustvc.getDocumentData(file2)).toStrictEqual(originalTxtData);

      expect(successMock).toHaveBeenCalledWith('Wrapped OpenAttestation document: out/raw-did.json');
      expect(successMock).toHaveBeenCalledWith('Wrapped OpenAttestation document: out/raw-txt.json');
      expect(successMock).toHaveBeenCalledWith('All documents wrapped in individual mode');
    });
  });

  describe('testing with OA v3 fixtures', () => {
    const RAW_OA_V3_DID_FILE = 'tests/fixtures/wrap/oa_v3/raw_oa_docs_v3/raw-dns-did.json';
    const RAW_OA_V3_TXT_FILE = 'tests/fixtures/wrap/oa_v3/raw_oa_docs_v3/raw-dns-txt.json';

    it('should wrap documents in batch mode successfully', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const actualUtils = await vi.importActual<typeof import('../../../src/utils')>(
        '../../../src/utils',
      );
      const actualTrustvc = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const wrapOADocumentsMock = trustvc.wrapOADocuments as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;

      readMock.mockImplementation(actualUtils.readOpenAttestationFile as unknown as any);
      wrapOADocumentsMock.mockImplementation(actualTrustvc.wrapOADocuments as unknown as any);

      const originalDidData = actualUtils.readOpenAttestationFile(RAW_OA_V3_DID_FILE);
      const originalTxtData = actualUtils.readOpenAttestationFile(RAW_OA_V3_TXT_FILE);

      await wrapOA({
        mode: WrapMode.Batch,
        docPaths: [RAW_OA_V3_DID_FILE, RAW_OA_V3_TXT_FILE],
        pathToOutputDirectory: './out',
      });

      expect(wrapOADocumentsMock).toHaveBeenCalledTimes(1);
      expect(wrapOADocumentsMock.mock.calls[0][0]).toHaveLength(2);

      const didCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-dns-did.json');
      const txtCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-dns-txt.json');
      expect(didCall).toBeTruthy();
      expect(txtCall).toBeTruthy();

      const file1 = didCall![1] as any;
      const file2 = txtCall![1] as any;
      const proof1 = file1.proof;
      const proof2 = file2.proof;

      const merkleRoot = proof1.merkleRoot as string;
      expect(merkleRoot).toHaveLength(64);
      expect(merkleRoot).toStrictEqual(proof1.merkleRoot);
      expect(merkleRoot).toStrictEqual(proof2.merkleRoot);
      expect(merkleRoot).not.toStrictEqual(proof1.targetHash);
      expect(merkleRoot).not.toStrictEqual(proof2.targetHash);
      expect(proof1.targetHash).not.toStrictEqual(proof2.targetHash);

      expect(actualTrustvc.getDocumentData(file1)).toStrictEqual(originalDidData);
      expect(actualTrustvc.getDocumentData(file2)).toStrictEqual(originalTxtData);

      expect(successMock).toHaveBeenCalledWith('Wrapped OpenAttestation document: out/raw-dns-did.json');
      expect(successMock).toHaveBeenCalledWith('Wrapped OpenAttestation document: out/raw-dns-txt.json');
      expect(successMock).toHaveBeenCalledWith('All documents wrapped in batch mode');
    });

    it('should wrap documents in individual mode with merkleRoot equal to targetHash', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const actualUtils = await vi.importActual<typeof import('../../../src/utils')>(
        '../../../src/utils',
      );
      const actualTrustvc = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const wrapOADocumentMock = trustvc.wrapOADocument as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;

      readMock.mockImplementation(actualUtils.readOpenAttestationFile as unknown as any);
      wrapOADocumentMock.mockImplementation(actualTrustvc.wrapOADocument as unknown as any);

      const originalDidData = actualUtils.readOpenAttestationFile(RAW_OA_V3_DID_FILE);
      const originalTxtData = actualUtils.readOpenAttestationFile(RAW_OA_V3_TXT_FILE);

      await wrapOA({
        mode: WrapMode.Individual,
        docPaths: [RAW_OA_V3_DID_FILE, RAW_OA_V3_TXT_FILE],
        pathToOutputDirectory: './out',
      });

      expect(wrapOADocumentMock).toHaveBeenCalledTimes(2);

      const didCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-dns-did.json');
      const txtCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-dns-txt.json');
      expect(didCall).toBeTruthy();
      expect(txtCall).toBeTruthy();

      const file1 = didCall![1] as any;
      const file2 = txtCall![1] as any;
      const proof1 = file1.proof;
      const proof2 = file2.proof;

      expect(proof1.merkleRoot).toHaveLength(64);
      expect(proof2.merkleRoot).toHaveLength(64);
      expect(proof1.merkleRoot).toStrictEqual(proof1.targetHash);
      expect(proof2.merkleRoot).toStrictEqual(proof2.targetHash);
      expect(proof1.targetHash).not.toStrictEqual(proof2.targetHash);

      expect(actualTrustvc.getDocumentData(file1)).toStrictEqual(originalDidData);
      expect(actualTrustvc.getDocumentData(file2)).toStrictEqual(originalTxtData);

      expect(successMock).toHaveBeenCalledWith('Wrapped OpenAttestation document: out/raw-dns-did.json');
      expect(successMock).toHaveBeenCalledWith('Wrapped OpenAttestation document: out/raw-dns-txt.json');
      expect(successMock).toHaveBeenCalledWith('All documents wrapped in individual mode');
    });
  });
});
