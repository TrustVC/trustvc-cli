
import * as prompts from '@inquirer/prompts';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { promptForInputs, unwrapOA } from '../../../src/commands/oa/unwrap';

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
    getDocumentData: vi.fn(),
  };
});

describe('oa-unwrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForInputs', () => {
    it('should accept a single file path and return parsed inputs', async () => {
      (prompts.input as any).mockResolvedValueOnce('./wrapped.json').mockResolvedValueOnce('.');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      const result = await promptForInputs();

      expect(result).toStrictEqual({
        docPaths: ['./wrapped.json'],
        pathToOutputDirectory: '.',
      });
    });

    it('should accept a directory path and return documents in directory', async () => {
      (prompts.input as any).mockResolvedValueOnce('./docs').mockResolvedValueOnce('.');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(false);
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);
      (utils.documentsInDirectory as MockedFunction<any>).mockResolvedValue(['./docs/a.json', './docs/b.json']);

      const signale = await import('signale');
      const infoMock = (signale.default as any).info as MockedFunction<any>;

      const result = await promptForInputs();

      expect(result.docPaths).toEqual(['./docs/a.json', './docs/b.json']);
      expect(infoMock).toHaveBeenCalledWith('Found 2 document(s) to unwrap individually');
    });

    it('should throw error when provided path is neither a valid file nor directory', async () => {
      (prompts.input as any).mockResolvedValueOnce('./invalid');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(false);
      (utils.isDir as MockedFunction<any>).mockReturnValue(false);

      await expect(promptForInputs()).rejects.toThrow(
        'The provided path is neither a valid file nor directory',
      );
    });

    it('should throw error when no OpenAttestation documents are found in directory', async () => {
      (prompts.input as any).mockResolvedValueOnce('./docs');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(false);
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);
      (utils.documentsInDirectory as MockedFunction<any>).mockResolvedValue([]);

      await expect(promptForInputs()).rejects.toThrow('No OpenAttestation documents found in directory');
    });

    it('should abide by validation rules for wrapped document path input', async () => {
      (prompts.input as any).mockResolvedValueOnce('./wrapped.json').mockResolvedValueOnce('.');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      await promptForInputs();

      const [wrappedPathArgs] = (prompts.input as any).mock.calls.map((c: any[]) => c[0]);
      expect(wrappedPathArgs.required).toBe(true);
      expect(wrappedPathArgs.validate('')).toBe('Wrapped OpenAttestation document path is required');
      expect(wrappedPathArgs.validate('   ')).toBe('Wrapped OpenAttestation document path is required');
      expect(wrappedPathArgs.validate('./wrapped.json')).toBe(true);
    });

    it('should set default output directory to . when user provides no value', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./wrapped.json')
        .mockResolvedValueOnce('.');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      const result = await promptForInputs();

      expect(result.pathToOutputDirectory).toBe('.');
      const [, outputArgs] = (prompts.input as any).mock.calls.map((c: any[]) => c[0]);
      expect(outputArgs.required).toBe(false);
      expect(outputArgs.default).toBe('.');
    });

    it('should throw error when output directory is invalid', async () => {
      (prompts.input as any).mockResolvedValueOnce('./wrapped.json').mockResolvedValueOnce('./bad-out');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(true);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(false);

      await expect(promptForInputs()).rejects.toThrow('Output path is not valid');
    });
  });

  describe('unwrapOA', () => {
    it('should error when unwrapped document is falsy and not write to disk', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const getDocumentDataMock = trustvc.getDocumentData as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;

      readMock.mockReturnValueOnce({ wrapped: true });
      getDocumentDataMock.mockReturnValueOnce(undefined);

      await unwrapOA({
        docPaths: ['./docs/a.json'],
        pathToOutputDirectory: '.',
      });

      expect(writeMock).not.toHaveBeenCalled();
      expect(errorMock).toHaveBeenCalledWith('Error while unwrapping OpenAttestation document: ./docs/a.json');
    });

    it('should error when getDocumentData throws and continue processing remaining documents', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const getDocumentDataMock = trustvc.getDocumentData as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;

      readMock.mockReturnValueOnce({ wrapped: 1 }).mockReturnValueOnce({ wrapped: 2 });
      getDocumentDataMock.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      getDocumentDataMock.mockReturnValueOnce({ unwrapped: 2 });

      await unwrapOA({
        docPaths: ['./docs/a.json', './docs/b.json'],
        pathToOutputDirectory: './out',
      });

      expect(errorMock).toHaveBeenCalledWith('Error while unwrapping OpenAttestation document: ./docs/a.json');
      expect(writeMock).toHaveBeenCalledTimes(1);
      expect(writeMock).toHaveBeenCalledWith('out/b.json', { unwrapped: 2 }, true);
      expect(successMock).toHaveBeenCalledWith('Unwrapped OpenAttestation document: ./docs/b.json');
    });
  });

  describe('testing with OA v2 fixtures', () => {
    const RAW_OA_V2_DID_FILE = 'tests/fixtures/wrap/oa_v2/raw_oa_docs_v2/raw-did.json';
    const RAW_OA_V2_TXT_FILE = 'tests/fixtures/wrap/oa_v2/raw_oa_docs_v2/raw-txt.json';

    const BATCH_WRAPPED_OA_V2_DID_FILE =
      'tests/fixtures/wrap/oa_v2/batch_wrap_oa_docs_v2/batch-wrapped-did.json';
    const BATCH_WRAPPED_OA_V2_TXT_FILE =
      'tests/fixtures/wrap/oa_v2/batch_wrap_oa_docs_v2/batch-wrapped-txt.json';

    const INDIV_WRAPPED_OA_V2_DID_FILE =
      'tests/fixtures/wrap/oa_v2/indiv_wrap_oa_docs_v2/indiv-wrapped-did.json';
    const INDIV_WRAPPED_OA_V2_TXT_FILE =
      'tests/fixtures/wrap/oa_v2/indiv_wrap_oa_docs_v2/indiv-wrapped-txt.json';

    it('should unwrap batch wrapped documents back to the original raw document', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');

      const actualUtils = await vi.importActual<typeof import('../../../src/utils')>(
        '../../../src/utils',
      );
      const actualTrustvc = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const getDocumentDataMock = trustvc.getDocumentData as MockedFunction<any>;

      readMock.mockImplementation(actualUtils.readOpenAttestationFile as unknown as any);
      getDocumentDataMock.mockImplementation(actualTrustvc.getDocumentData as unknown as any);

      const originalDidData = actualUtils.readOpenAttestationFile(RAW_OA_V2_DID_FILE);
      const originalTxtData = actualUtils.readOpenAttestationFile(RAW_OA_V2_TXT_FILE);

      await unwrapOA({
        docPaths: [BATCH_WRAPPED_OA_V2_DID_FILE, BATCH_WRAPPED_OA_V2_TXT_FILE],
        pathToOutputDirectory: './out',
      });

      const didCall = writeMock.mock.calls.find((c) => c[0] === 'out/batch-wrapped-did.json');
      const txtCall = writeMock.mock.calls.find((c) => c[0] === 'out/batch-wrapped-txt.json');
      expect(didCall).toBeTruthy();
      expect(txtCall).toBeTruthy();

      expect(didCall![1]).toStrictEqual(originalDidData);
      expect(txtCall![1]).toStrictEqual(originalTxtData);
    });

    it('should unwrap individually wrapped documents back to the original raw document', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');

      const actualUtils = await vi.importActual<typeof import('../../../src/utils')>(
        '../../../src/utils',
      );
      const actualTrustvc = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const getDocumentDataMock = trustvc.getDocumentData as MockedFunction<any>;

      readMock.mockImplementation(actualUtils.readOpenAttestationFile as unknown as any);
      getDocumentDataMock.mockImplementation(actualTrustvc.getDocumentData as unknown as any);

      const originalDidData = actualUtils.readOpenAttestationFile(RAW_OA_V2_DID_FILE);
      const originalTxtData = actualUtils.readOpenAttestationFile(RAW_OA_V2_TXT_FILE);

      await unwrapOA({
        docPaths: [INDIV_WRAPPED_OA_V2_DID_FILE, INDIV_WRAPPED_OA_V2_TXT_FILE],
        pathToOutputDirectory: './out',
      });

      const didCall = writeMock.mock.calls.find((c) => c[0] === 'out/indiv-wrapped-did.json');
      const txtCall = writeMock.mock.calls.find((c) => c[0] === 'out/indiv-wrapped-txt.json');
      expect(didCall).toBeTruthy();
      expect(txtCall).toBeTruthy();

      expect(didCall![1]).toStrictEqual(originalDidData);
      expect(txtCall![1]).toStrictEqual(originalTxtData);
    });
  });

  describe('testing with OA v3 fixtures', () => {
    const RAW_OA_V3_DID_FILE = 'tests/fixtures/wrap/oa_v3/raw_oa_docs_v3/raw-dns-did.json';
    const RAW_OA_V3_TXT_FILE = 'tests/fixtures/wrap/oa_v3/raw_oa_docs_v3/raw-dns-txt.json';

    const BATCH_WRAPPED_OA_V3_DID_FILE = 'tests/fixtures/wrap/oa_v3/batch_wrap_oa_docs_v3/raw-dns-did.json';
    const BATCH_WRAPPED_OA_V3_TXT_FILE = 'tests/fixtures/wrap/oa_v3/batch_wrap_oa_docs_v3/raw-dns-txt.json';

    const INDIV_WRAPPED_OA_V3_DID_FILE = 'tests/fixtures/wrap/oa_v3/indiv_wrap_oa_docs_v3/raw-dns-did.json';
    const INDIV_WRAPPED_OA_V3_TXT_FILE = 'tests/fixtures/wrap/oa_v3/indiv_wrap_oa_docs_v3/raw-dns-txt.json';

    it('should unwrap batch wrapped documents back to the original raw document', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');

      const actualUtils = await vi.importActual<typeof import('../../../src/utils')>(
        '../../../src/utils',
      );
      const actualTrustvc = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const getDocumentDataMock = trustvc.getDocumentData as MockedFunction<any>;

      readMock.mockImplementation(actualUtils.readOpenAttestationFile as unknown as any);
      getDocumentDataMock.mockImplementation(actualTrustvc.getDocumentData as unknown as any);

      const originalDidData = actualUtils.readOpenAttestationFile(RAW_OA_V3_DID_FILE);
      const originalTxtData = actualUtils.readOpenAttestationFile(RAW_OA_V3_TXT_FILE);

      await unwrapOA({
        docPaths: [BATCH_WRAPPED_OA_V3_DID_FILE, BATCH_WRAPPED_OA_V3_TXT_FILE],
        pathToOutputDirectory: './out',
      });

      const didCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-dns-did.json');
      const txtCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-dns-txt.json');
      expect(didCall).toBeTruthy();
      expect(txtCall).toBeTruthy();

      expect(didCall![1]).toStrictEqual(originalDidData);
      expect(txtCall![1]).toStrictEqual(originalTxtData);
    });

    it('should unwrap individually wrapped documents back to the original raw document', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');

      const actualUtils = await vi.importActual<typeof import('../../../src/utils')>(
        '../../../src/utils',
      );
      const actualTrustvc = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const getDocumentDataMock = trustvc.getDocumentData as MockedFunction<any>;

      readMock.mockImplementation(actualUtils.readOpenAttestationFile as unknown as any);
      getDocumentDataMock.mockImplementation(actualTrustvc.getDocumentData as unknown as any);

      const originalDidData = actualUtils.readOpenAttestationFile(RAW_OA_V3_DID_FILE);
      const originalTxtData = actualUtils.readOpenAttestationFile(RAW_OA_V3_TXT_FILE);

      await unwrapOA({
        docPaths: [INDIV_WRAPPED_OA_V3_DID_FILE, INDIV_WRAPPED_OA_V3_TXT_FILE],
        pathToOutputDirectory: './out',
      });

      const didCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-dns-did.json');
      const txtCall = writeMock.mock.calls.find((c) => c[0] === 'out/raw-dns-txt.json');
      expect(didCall).toBeTruthy();
      expect(txtCall).toBeTruthy();

      expect(didCall![1]).toStrictEqual(originalDidData);
      expect(txtCall![1]).toStrictEqual(originalTxtData);
    });
  });
});

