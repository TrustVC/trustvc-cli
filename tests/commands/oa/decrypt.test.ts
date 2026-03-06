import path from 'path';
import * as prompts from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import fs from 'fs';
import { handler, promptForInputs } from '../../../src/commands/oa/decrypt';
import { encryptString } from '@trustvc/trustvc';

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
  password: vi.fn(),
}));

vi.mock('../../../src/utils', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
  return {
    ...actual,
    readDocumentFile: vi.fn(),
    ensureInputFileExists: vi.fn(),
    validateInputFileExists: vi.fn().mockReturnValue(true),
    resolveOutputJsonPath: (givenPath: string) => ({ path: givenPath, generated: false }),
  };
});

// Hex key used in promptForInputs test (any 64-char hex is valid format)
const TEST_KEY_INPUT = 'a'.repeat(64);
// Resolve fixture from project root so tests work regardless of cwd when run via npm test
const OA_FIXTURE_PATH = path.resolve(
  process.cwd(),
  'tests/fixtures/wrap/oa_v3/raw_oa_docs_v3/raw-dns-did.json',
);

describe('oa-decrypt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.spyOn(fs, 'writeFileSync');
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('promptForInputs', () => {
    it('should return inputs when user provides encrypted path, output path and key', async () => {
      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./decrypted.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY_INPUT);

      const result = await promptForInputs();

      expect(result).toEqual({
        inputEncryptedPath: './encrypted.json',
        outputPath: './decrypted.json',
        key: TEST_KEY_INPUT,
      });
    });
  });

  describe('handler', () => {
    it('should decrypt valid encrypted payload and write document string', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
      const oaDocument = actualUtils.readDocumentFile(OA_FIXTURE_PATH);
      const documentString = JSON.stringify(oaDocument);

      const { key, cipherText, iv, tag, type } = encryptString(documentString);
      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;

      readMock.mockReturnValue({ cipherText, iv, tag, type });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./decrypted.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(key);

      await handler();

      expect(readMock).toHaveBeenCalledWith('./encrypted.json');
      expect(fs.writeFileSync).toHaveBeenCalledWith('./decrypted.json', documentString, 'utf8');
      expect(successMock).toHaveBeenCalledWith('Decrypted document saved to: ./decrypted.json');
    });

    it('should trim the key before decryption', async () => {
      const utils = await import('../../../src/utils');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
      const oaDocument = actualUtils.readDocumentFile(OA_FIXTURE_PATH);
      const documentString = JSON.stringify(oaDocument);
      const { key, cipherText, iv, tag, type } = encryptString(documentString);
      const readMock = utils.readDocumentFile as MockedFunction<any>;

      readMock.mockReturnValue({ cipherText, iv, tag, type });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./decrypted.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(`  ${key}  `);

      await handler();

      expect(fs.writeFileSync).toHaveBeenCalledWith('./decrypted.json', documentString, 'utf8');
    });

    it('should log a clear error and set exitCode when encrypted payload has wrong type', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;
      readMock.mockReturnValue({ type: 'wrong-type', cipherText: 'abc', iv: 'x', tag: 'y' });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./bad.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce('0'.repeat(64));

      await handler();

      expect(errorMock).toHaveBeenCalledWith(
        'Invalid encrypted document: expected cipherText, iv, tag and type "OPEN-ATTESTATION-TYPE-1".',
      );
      expect(process.exitCode).toBe(1);
    });

    it('should log a clear error and set exitCode when encrypted payload is missing cipherText', async () => {
      const utils = await import('../../../src/utils');
      const readMock = utils.readDocumentFile as MockedFunction<any>;
      readMock.mockReturnValue({ type: 'OPEN-ATTESTATION-TYPE-1' });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./bad.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce('0'.repeat(64));

      await handler();

      expect(process.exitCode).toBe(1);
    });

    it('should log a friendly error and set exitCode when key is wrong', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
      const oaDocument = actualUtils.readDocumentFile(OA_FIXTURE_PATH);
      const { cipherText, iv, tag, type } = encryptString(JSON.stringify(oaDocument));
      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;

      readMock.mockReturnValue({ cipherText, iv, tag, type });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce('0'.repeat(64));

      await handler();

      expect(errorMock).toHaveBeenCalledWith(
        'Failed to decrypt document. The key is likely incorrect or the file is corrupted.',
      );
      expect(process.exitCode).toBe(1);
    });

    it('should log a friendly error and set exitCode when readDocumentFile throws', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;
      readMock.mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('/nonexistent.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce('0'.repeat(64));

      await handler();

      expect(errorMock).toHaveBeenCalledWith('File not found');
      expect(process.exitCode).toBe(1);
    });

    it('should show a file-not-found message when underlying error is ENOENT', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;
      readMock.mockImplementationOnce(() => {
        const err: NodeJS.ErrnoException = new Error('ENOENT') as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        err.path = '/nonexistent.json';
        throw err;
      });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('/nonexistent.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce('0'.repeat(64));

      await handler();

      expect(errorMock).toHaveBeenCalledWith(
        'Unable to read encrypted document. File not found at: /nonexistent.json',
      );
      expect(process.exitCode).toBe(1);
    });
  });
});
