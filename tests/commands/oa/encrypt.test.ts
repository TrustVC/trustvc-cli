import path from 'path';
import * as prompts from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { handler, promptForInputs } from '../../../src/commands/oa/encrypt';

// Resolve fixture from project root so tests work regardless of cwd when run via npm test
const FIXTURE_DOC = path.resolve(
  process.cwd(),
  'tests/fixtures/wrap/oa_v3/raw_oa_docs_v3/raw-dns-did.json',
);
const TEST_KEY = 'my-secret-encryption-key';

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
    readFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

describe('oa-encrypt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('promptForInputs', () => {
    it('should return inputs when user provides document path, output path and key', async () => {
      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce(FIXTURE_DOC)
        .mockResolvedValueOnce('./encrypted.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      const result = await promptForInputs();

      expect(result).toEqual({
        inputDocumentPath: FIXTURE_DOC,
        outputEncryptedPath: './encrypted.json',
        key: TEST_KEY,
      });
    });
  });

  describe('handler', () => {
    it('should read document, encrypt with prompted key, and write encrypted payload', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce(FIXTURE_DOC)
        .mockResolvedValueOnce('./tmp-encrypted-out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

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
      expect(payload).toHaveProperty('type', 'OPEN-ATTESTATION-TYPE-1');
      expect(payload).toHaveProperty('cipherText');
      expect(payload).toHaveProperty('iv');
      expect(payload).toHaveProperty('tag');
      expect(typeof payload.cipherText).toBe('string');
      expect(successMock).toHaveBeenCalledWith(
        'Encrypted document saved to: ./tmp-encrypted-out.json',
      );
      expect(warnMock).toHaveBeenCalledWith(
        'Remember the encryption key you entered — you will need it to decrypt.',
      );
    });

    it('should produce ciphertext decryptable with the key entered by user', async () => {
      const utils = await import('../../../src/utils');
      const { decryptString } = await import('@trustvc/trustvc');
      const crypto = await import('crypto');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce(FIXTURE_DOC)
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      const readMock = utils.readFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      readMock.mockImplementation(actualUtils.readFile as unknown as any);

      await handler();

      const payload = writeMock.mock.calls[0][1];
      const derivedKey = crypto.createHash('sha256').update(TEST_KEY, 'utf8').digest('hex');
      const documentString = decryptString({
        cipherText: payload.cipherText,
        iv: payload.iv,
        tag: payload.tag,
        key: derivedKey,
        type: payload.type,
      });
      const originalContent = actualUtils.readFile(FIXTURE_DOC);
      expect(documentString).toStrictEqual(originalContent);
    });

    it('should call signale.error and rethrow when readFile throws', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('/nonexistent.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      const readMock = utils.readFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;
      readMock.mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      await expect(handler()).rejects.toThrow('File not found');
      expect(errorMock).toHaveBeenCalledWith('File not found');
    });
  });
});
