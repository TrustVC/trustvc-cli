import path from 'path';
import * as prompts from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import crypto from 'crypto';
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
  return { ...actual, readDocumentFile: vi.fn() };
});

const TEST_KEY = 'test-decryption-key-32-bytes-long-hex!!';
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('promptForInputs', () => {
    it('should return inputs when user provides encrypted path, output path and key', async () => {
      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./decrypted.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      const result = await promptForInputs();

      expect(result).toEqual({
        inputEncryptedPath: './encrypted.json',
        outputPath: './decrypted.json',
        key: TEST_KEY,
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

      const derivedKey = crypto.createHash('sha256').update(TEST_KEY, 'utf8').digest('hex');
      const { cipherText, iv, tag, type } = encryptString(documentString, derivedKey);
      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;

      readMock.mockReturnValue({ cipherText, iv, tag, type });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./decrypted.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

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
      const derivedKey = crypto.createHash('sha256').update(TEST_KEY, 'utf8').digest('hex');
      const { cipherText, iv, tag, type } = encryptString(documentString, derivedKey);
      const readMock = utils.readDocumentFile as MockedFunction<any>;

      readMock.mockReturnValue({ cipherText, iv, tag, type });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./decrypted.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(`  ${TEST_KEY}  `);

      await handler();

      expect(fs.writeFileSync).toHaveBeenCalledWith('./decrypted.json', documentString, 'utf8');
    });

    it('should throw when encrypted payload has wrong type', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;
      readMock.mockReturnValue({ type: 'wrong-type', cipherText: 'abc', iv: 'x', tag: 'y' });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./bad.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      await expect(handler()).rejects.toThrow(
        'Invalid encrypted document: expected cipherText, iv, tag and type "OPEN-ATTESTATION-TYPE-1".',
      );
      expect(errorMock).toHaveBeenCalled();
    });

    it('should throw when encrypted payload is missing cipherText', async () => {
      const utils = await import('../../../src/utils');
      const readMock = utils.readDocumentFile as MockedFunction<any>;
      readMock.mockReturnValue({ type: 'OPEN-ATTESTATION-TYPE-1' });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./bad.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      await expect(handler()).rejects.toThrow(
        'Invalid encrypted document: expected cipherText, iv, tag and type "OPEN-ATTESTATION-TYPE-1".',
      );
    });

    it('should throw when key is wrong', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
      const oaDocument = actualUtils.readDocumentFile(OA_FIXTURE_PATH);
      const derivedKey = crypto.createHash('sha256').update(TEST_KEY, 'utf8').digest('hex');
      const { cipherText, iv, tag, type } = encryptString(JSON.stringify(oaDocument), derivedKey);
      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;

      readMock.mockReturnValue({ cipherText, iv, tag, type });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce('wrong-key');

      await expect(handler()).rejects.toThrow('Error decrypting message');
      expect(errorMock).toHaveBeenCalled();
    });

    it('should call signale.error and rethrow when readDocumentFile throws', async () => {
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
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      await expect(handler()).rejects.toThrow('File not found');
      expect(errorMock).toHaveBeenCalledWith('File not found');
    });
  });
});
