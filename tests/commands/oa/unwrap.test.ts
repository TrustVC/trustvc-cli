
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

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    mkdirSync: vi.fn(),
  };
});

vi.mock('../../../src/utils', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
  return {
    ...actual,
    documentsInDirectory: vi.fn(),
    isDir: vi.fn(),
    isFile: vi.fn(),
    readOpenAttestationFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    getDataV2: vi.fn(),
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
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);

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
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);

      await promptForInputs();

      const [wrappedPathArgs] = (prompts.input as any).mock.calls.map((c: any[]) => c[0]);
      expect(wrappedPathArgs.required).toBe(true);
      expect(wrappedPathArgs.validate('')).toBe('Wrapped OpenAttestation document path is required');
      expect(wrappedPathArgs.validate('   ')).toBe('Wrapped OpenAttestation document path is required');
      expect(wrappedPathArgs.validate('./wrapped.json')).toBe(true);
    });

    it('should create output directory when it does not exist', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./wrapped.json')
        .mockResolvedValueOnce('./new-out');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(true);
      (utils.isDir as MockedFunction<any>).mockImplementation((p: any) => p !== './new-out');

      const fs = await import('fs');
      const mkdirSyncMock = fs.mkdirSync as unknown as MockedFunction<any>;

      const signale = await import('signale');
      const infoMock = (signale.default as any).info as MockedFunction<any>;

      const result = await promptForInputs();

      expect(result.pathToOutputDirectory).toBe('./new-out');
      expect(infoMock).toHaveBeenCalledWith('Directory not found; Creating new directory: ./new-out');
      expect(mkdirSyncMock).toHaveBeenCalledWith('./new-out', { recursive: true });
    });

    it('should set default output directory to . when user provides no value', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./wrapped.json')
        .mockResolvedValueOnce('.');

      const utils = await import('../../../src/utils');
      (utils.isFile as MockedFunction<any>).mockReturnValue(true);
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);

      const result = await promptForInputs();

      expect(result.pathToOutputDirectory).toBe('.');
      const [, outputArgs] = (prompts.input as any).mock.calls.map((c: any[]) => c[0]);
      expect(outputArgs.required).toBe(false);
      expect(outputArgs.default).toBe('.');
    });
  });

  describe('unwrapOA', () => {
    it('should unwrap a document and write unwrapped content to output directory', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const getDataV2Mock = trustvc.getDataV2 as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;

      readMock.mockReturnValueOnce({ wrapped: true });
      getDataV2Mock.mockReturnValueOnce({ unwrapped: true });

      await unwrapOA({
        docPaths: ['./docs/a.json'],
        pathToOutputDirectory: './out',
      });

      expect(getDataV2Mock).toHaveBeenCalledWith({ wrapped: true });
      expect(writeMock).toHaveBeenCalledWith('out/a.json', { unwrapped: true }, true);
      expect(successMock).toHaveBeenCalledWith('Unwrapped OpenAttestation document: ./docs/a.json');
    });

    it('should error when unwrapped document is falsy and not write to disk', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const getDataV2Mock = trustvc.getDataV2 as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;

      readMock.mockReturnValueOnce({ wrapped: true });
      getDataV2Mock.mockReturnValueOnce(undefined);

      await unwrapOA({
        docPaths: ['./docs/a.json'],
        pathToOutputDirectory: '.',
      });

      expect(writeMock).not.toHaveBeenCalled();
      expect(errorMock).toHaveBeenCalledWith('Error while unwrapping OpenAttestation document: ./docs/a.json');
    });

    it('should error when getDataV2 throws and continue processing remaining documents', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const getDataV2Mock = trustvc.getDataV2 as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;

      readMock.mockReturnValueOnce({ wrapped: 1 }).mockReturnValueOnce({ wrapped: 2 });
      getDataV2Mock.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      getDataV2Mock.mockReturnValueOnce({ unwrapped: 2 });

      await unwrapOA({
        docPaths: ['./docs/a.json', './docs/b.json'],
        pathToOutputDirectory: './out',
      });

      expect(errorMock).toHaveBeenCalledWith('Error while unwrapping OpenAttestation document: ./docs/a.json');
      expect(writeMock).toHaveBeenCalledTimes(1);
      expect(writeMock).toHaveBeenCalledWith('out/b.json', { unwrapped: 2 }, true);
      expect(successMock).toHaveBeenCalledWith('Unwrapped OpenAttestation document: ./docs/b.json');
    });

    it('should call readOpenAttestationFile once per document', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const getDataV2Mock = trustvc.getDataV2 as MockedFunction<any>;

      readMock.mockReturnValue({ wrapped: true });
      getDataV2Mock.mockReturnValue({ unwrapped: true });

      await unwrapOA({
        docPaths: ['./docs/a.json', './docs/b.json', './docs/c.json'],
        pathToOutputDirectory: '.',
      });

      expect(readMock).toHaveBeenCalledTimes(3);
    });
  });
});

