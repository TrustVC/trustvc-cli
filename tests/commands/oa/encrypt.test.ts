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
    readDocumentFile: vi.fn(),
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
    it('should read OA document, encrypt with prompted key, and write encrypted payload', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce(FIXTURE_DOC)
        .mockResolvedValueOnce('./tmp-encrypted-out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      const successMock = (signale.default as any).success as MockedFunction<any>;
      const warnMock = (signale.default as any).warn as MockedFunction<any>;

      readMock.mockImplementation(actualUtils.readDocumentFile as unknown as any);

      await handler();

      expect(readMock).toHaveBeenCalledWith(FIXTURE_DOC);
      expect(writeMock).toHaveBeenCalledTimes(1);
      const [writtenPath, payload] = writeMock.mock.calls[0];
      expect(writtenPath).toBe('./tmp-encrypted-out.json');
      expect(payload).toHaveProperty('type', 'encrypted-document');
      expect(payload).toHaveProperty('ciphertext');
      expect(typeof payload.ciphertext).toBe('string');
      expect(successMock).toHaveBeenCalledWith(
        'Encrypted document saved to: ./tmp-encrypted-out.json',
      );
      expect(warnMock).toHaveBeenCalledWith(
        'Remember the encryption key you entered — you will need it to decrypt.',
      );
    });

    it('should produce ciphertext decryptable with the key entered by user', async () => {
      const utils = await import('../../../src/utils');
      const trustvc = await import('@trustvc/trustvc');
      const actualUtils =
        await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce(FIXTURE_DOC)
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const writeMock = utils.writeFile as MockedFunction<any>;
      readMock.mockImplementation(actualUtils.readDocumentFile as unknown as any);

      await handler();

      const payload = writeMock.mock.calls[0][1];
      const documentString = trustvc.decrypt(payload.ciphertext, TEST_KEY);
      const document = JSON.parse(documentString);
      const original = actualUtils.readDocumentFile(FIXTURE_DOC);
      expect(document).toStrictEqual(original);
    });

    it('should throw when document is not a valid Open Attestation document', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('./not-oa.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;
      readMock.mockReturnValue({ foo: 'bar', notOA: true });

      await expect(handler()).rejects.toThrow(
        'The document is not a valid Open Attestation document. Expected raw OA v2/v3 or wrapped OA v2/v3.',
      );
      expect(errorMock).toHaveBeenCalled();
    });

    it('should call signale.error and rethrow when readDocumentFile throws', async () => {
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce('/nonexistent.json')
        .mockResolvedValueOnce('./out.json');
      (prompts.password as MockedFunction<any>).mockResolvedValueOnce(TEST_KEY);

      const readMock = utils.readDocumentFile as MockedFunction<any>;
      const errorMock = (signale.default as any).error as MockedFunction<any>;
      readMock.mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      await expect(handler()).rejects.toThrow('File not found');
      expect(errorMock).toHaveBeenCalledWith('File not found');
    });
  });
});
