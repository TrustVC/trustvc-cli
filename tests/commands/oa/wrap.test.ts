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
      (utils.isDir as MockedFunction<any>).mockImplementation((p: any) => p === './docs' || p === './out');
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
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);

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
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);

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
      (utils.isDir as MockedFunction<any>).mockReturnValue(true);

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

    it('should create output directory when it does not exist', async () => {
      (prompts.select as any).mockResolvedValueOnce(WrapMode.Individual);
      (prompts.input as any).mockResolvedValueOnce('./doc.json').mockResolvedValueOnce('./new-out');

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
  });

  describe('wrapOA', () => {
    it('should wrap documents in batch mode and write each wrapped document to disk', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const wrapOADocumentsMock = trustvc.wrapOADocuments as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;

      readMock.mockReturnValueOnce({ raw: 1 }).mockReturnValueOnce({ raw: 2 });
      wrapOADocumentsMock.mockResolvedValue([{ wrapped: 1 }, { wrapped: 2 }]);

      await wrapOA({
        mode: WrapMode.Batch,
        docPaths: ['./docs/a.json', './docs/b.json'],
        pathToOutputDirectory: './out',
      });

      expect(wrapOADocumentsMock).toHaveBeenCalledWith([{ raw: 1 }, { raw: 2 }]);
      expect(writeMock).toHaveBeenCalledWith('out/a.json', { wrapped: 1 }, true);
      expect(writeMock).toHaveBeenCalledWith('out/b.json', { wrapped: 2 }, true);
      expect(successMock).toHaveBeenCalledWith('Wrapped OpenAttestation document: out/a.json');
      expect(successMock).toHaveBeenCalledWith('Wrapped OpenAttestation document: out/b.json');
      expect(successMock).toHaveBeenCalledWith('All documents wrapped in batch mode');
    });

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

    it('should not log error message twice when thrown value is not an Error in individual mode', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const signale = await import('signale');

      const readMock = utils.readOpenAttestationFile as MockedFunction<any>;
      const wrapOADocumentMock = trustvc.wrapOADocument as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;

      readMock.mockReturnValueOnce({ raw: 1 });
      wrapOADocumentMock.mockRejectedValueOnce('non-error');

      await wrapOA({
        mode: WrapMode.Individual,
        docPaths: ['./docs/a.json'],
        pathToOutputDirectory: '.',
      });

      expect(errorMock).toHaveBeenCalledTimes(1);
      expect(errorMock).toHaveBeenCalledWith('Error while wrapping OpenAttestation document: ./docs/a.json');
    });
  });
});

