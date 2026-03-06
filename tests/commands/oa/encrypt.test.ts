import path from 'path';
import * as prompts from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { handler, promptForInputs } from '../../../src/commands/oa/encrypt';

// Resolve fixture from project root so tests work regardless of cwd when run via npm test
const FIXTURE_DOC = path.resolve(
  process.cwd(),
  'tests/fixtures/wrap/oa_v3/raw_oa_docs_v3/raw-dns-did.json',
);

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

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
}));

vi.mock('../../../src/utils', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    ensureInputFileExists: vi.fn(),
    validateInputFileExists: vi.fn().mockReturnValue(true),
    resolveOutputJsonPath: (givenPath: string) => ({ path: givenPath, generated: false }),
  };
});

describe('oa-encrypt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('promptForInputs', () => {
    it('should return inputs when user provides document path and output path', async () => {
      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce(FIXTURE_DOC)
        .mockResolvedValueOnce('./encrypted.json');

      const result = await promptForInputs();

      expect(result).toEqual({
        inputDocumentPath: FIXTURE_DOC,
        outputEncryptedPath: './encrypted.json',
      });
    });
  });

  describe('handler', () => {
    it('should read document, encrypt with generated key, write payload (no key in file), and print key', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce(FIXTURE_DOC)
        .mockResolvedValueOnce('./tmp-encrypted-out.json');

      const readMock = utils.readFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;
      const warnMock = (signale.default as any).warn as MockedFunction<any>;

      readMock.mockImplementation(actualUtils.readFile as unknown as any);

      await handler();

      expect(readMock).toHaveBeenCalledWith(FIXTURE_DOC);
      expect(writeMock).toHaveBeenCalledTimes(1);
      const [writtenPath, payload] = writeMock.mock.calls[0];
      expect(writtenPath).toBe('./tmp-encrypted-out.json');
      expect(payload).not.toHaveProperty('key');
      expect(payload).toHaveProperty('type', 'OPEN-ATTESTATION-TYPE-1');
      expect(payload).toHaveProperty('cipherText');
      expect(payload).toHaveProperty('iv');
      expect(payload).toHaveProperty('tag');
      expect(typeof payload.cipherText).toBe('string');
      expect(successMock).toHaveBeenCalledWith(
        'Encrypted document saved to: ./tmp-encrypted-out.json',
      );
      expect(warnMock).toHaveBeenCalled();
      expect(warnMock.mock.calls[0][0]).toContain(
        "Here is the key to decrypt the document: don't lose it:",
      );
    });

    it('should produce ciphertext decryptable with the printed key', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
      const encryptSpy = vi.spyOn(trustvc, 'encryptString');

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce(FIXTURE_DOC)
        .mockResolvedValueOnce('./out.json');

      const readMock = utils.readFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      readMock.mockImplementation(actualUtils.readFile as unknown as any);

      await handler();

      const key = (encryptSpy.mock.results[0]?.value as { key: string })?.key;
      expect(key).toBeTruthy();
      const payload = writeMock.mock.calls[0][1];
      const documentString = trustvc.decryptString({
        cipherText: payload.cipherText,
        iv: payload.iv,
        tag: payload.tag,
        key: key!,
        type: payload.type,
      });
      expect(documentString).toStrictEqual(actualUtils.readFile(FIXTURE_DOC));
      encryptSpy.mockRestore();
    });

    it('should log a friendly error and set exitCode when readFile throws', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('/nonexistent.json')
        .mockResolvedValueOnce('./out.json');

      const ensureMock = utils.ensureInputFileExists as MockedFunction<any>;
      ensureMock.mockImplementationOnce(() => {
        throw new Error('File not found: /nonexistent.json');
      });

      const errorMock = (signale.default as any).error as MockedFunction<any>;

      await handler();

      expect(errorMock).toHaveBeenCalledWith('File not found: /nonexistent.json');
      expect(process.exitCode).toBe(1);
    });

    it('should show a file-not-found message when input file does not exist', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('/nonexistent.json')
        .mockResolvedValueOnce('./out.json');

      const ensureMock = utils.ensureInputFileExists as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;
      ensureMock.mockImplementationOnce(() => {
        throw new Error('File not found: /nonexistent.json');
      });

      await handler();

      expect(errorMock).toHaveBeenCalledWith('File not found: /nonexistent.json');
      expect(process.exitCode).toBe(1);
    });
  });
});
