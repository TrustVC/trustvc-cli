import path from 'path';
import * as prompts from '@inquirer/prompts';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { handler, promptForInputs } from '../../../src/commands/oa/decrypt';
import { encrypt } from '@trustvc/trustvc';

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
    writeFile: vi.fn(),
  };
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
    it('should decrypt valid encrypted OA payload and write document', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
      const oaDocument = actualUtils.readDocumentFile(OA_FIXTURE_PATH);

      const ciphertext = encrypt(JSON.stringify(oaDocument), TEST_KEY);
      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;

      readMock.mockReturnValue({ type: 'encrypted-document', ciphertext });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./decrypted.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      await handler();

      expect(readMock).toHaveBeenCalledWith('./encrypted.json');
      expect(writeMock).toHaveBeenCalledWith('./decrypted.json', oaDocument, true);
      expect(successMock).toHaveBeenCalledWith('Decrypted document saved to: ./decrypted.json');
    });

    it('should trim the key before decryption', async () => {
      const utils = await import('../../../src/utils');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
      const oaDocument = actualUtils.readDocumentFile(OA_FIXTURE_PATH);
      const ciphertext = encrypt(JSON.stringify(oaDocument), TEST_KEY);
      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;

      readMock.mockReturnValue({ type: 'encrypted-document', ciphertext });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./decrypted.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(`  ${TEST_KEY}  `);

      await handler();

      expect(writeMock).toHaveBeenCalledWith('./decrypted.json', oaDocument, true);
    });

    it('should throw when encrypted payload has wrong type', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;
      readMock.mockReturnValue({ type: 'wrong-type', ciphertext: 'abc' });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./bad.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      await expect(handler()).rejects.toThrow(
        'Invalid encrypted document: expected an object with type "encrypted-document" and "ciphertext" field.',
      );
      expect(errorMock).toHaveBeenCalled();
    });

    it('should throw when encrypted payload is missing ciphertext', async () => {
      const utils = await import('../../../src/utils');
      const readMock = utils.readDocumentFile as MockedFunction<any>;
      readMock.mockReturnValue({ type: 'encrypted-document' });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./bad.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      await expect(handler()).rejects.toThrow(
        'Invalid encrypted document: expected an object with type "encrypted-document" and "ciphertext" field.',
      );
    });

    it('should throw when key is wrong', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
      const oaDocument = actualUtils.readDocumentFile(OA_FIXTURE_PATH);
      const ciphertext = encrypt(JSON.stringify(oaDocument), TEST_KEY);
      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;

      readMock.mockReturnValue({ type: 'encrypted-document', ciphertext });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce('wrong-key');

      await expect(handler()).rejects.toThrow(
        'Decryption succeeded but the result is not valid JSON. The key may be incorrect.',
      );
      expect(errorMock).toHaveBeenCalled();
    });

    it('should throw when decrypted content is not a valid OA document', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      const nonOADocument = { foo: 'bar', notOA: true };
      const ciphertext = encrypt(JSON.stringify(nonOADocument), TEST_KEY);
      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;

      readMock.mockReturnValue({ type: 'encrypted-document', ciphertext });

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./encrypted.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      await expect(handler()).rejects.toThrow(
        'Decrypted content is not a valid Open Attestation document. Expected raw OA v2/v3 or wrapped OA v2/v3.',
      );
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
