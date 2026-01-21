import * as prompts from '@inquirer/prompts';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { promptForInputs, signDocuments } from '../../../src/commands/oa/sign';
import { OASignInput } from '../../../src/types';

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
    isDirectoryValid: vi.fn(),
    getPrivateKey: vi.fn(),
    documentsInDirectory: vi.fn(),
    readDocumentFile: vi.fn(),
    writeDocumentToDisk: vi.fn(),
  };
});

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    signOA: vi.fn(),
  };
});

describe('oa-sign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForInputs', () => {
    it('should return parsed inputs when using environment variable for private key', async () => {
      process.env.OA_PRIVATE_KEY = 'test-private-key';

      (prompts.input as any)
        .mockResolvedValueOnce('./raw-documents')
        .mockResolvedValueOnce('./output')
        .mockResolvedValueOnce('did:ethr:0x1234#controller');
      (prompts.select as any).mockResolvedValueOnce('envVariable');

      const utils = await import('../../../src/utils');
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      const result = await promptForInputs();

      expect(result).toStrictEqual({
        rawDocumentsPath: './raw-documents',
        outputDir: './output',
        publicKey: 'did:ethr:0x1234#controller',
      });

      delete process.env.OA_PRIVATE_KEY;
    });

    it('should return parsed inputs when using private key file', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./raw-documents')
        .mockResolvedValueOnce('./output')
        .mockResolvedValueOnce('did:ethr:0x1234#controller')
        .mockResolvedValueOnce('./private-key.txt');
      (prompts.select as any).mockResolvedValueOnce('keyFile');

      const utils = await import('../../../src/utils');
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      const result = await promptForInputs();

      expect(result).toStrictEqual({
        rawDocumentsPath: './raw-documents',
        outputDir: './output',
        publicKey: 'did:ethr:0x1234#controller',
        keyFile: './private-key.txt',
      });
    });

    it('should return parsed inputs when using direct private key', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./raw-documents')
        .mockResolvedValueOnce('./output')
        .mockResolvedValueOnce('did:ethr:0x1234#controller')
        .mockResolvedValueOnce('0xabcdef1234567890');
      (prompts.select as any).mockResolvedValueOnce('keyDirect');

      const utils = await import('../../../src/utils');
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      const result = await promptForInputs();

      expect(result).toStrictEqual({
        rawDocumentsPath: './raw-documents',
        outputDir: './output',
        publicKey: 'did:ethr:0x1234#controller',
        key: '0xabcdef1234567890',
      });
    });

    it('should abide by validation rules for path inputs', async () => {
      process.env.OA_PRIVATE_KEY = 'test-private-key';

      (prompts.input as any)
        .mockResolvedValueOnce('./raw-documents')
        .mockResolvedValueOnce('./output')
        .mockResolvedValueOnce('did:ethr:0x1234#controller');
      (prompts.select as any).mockResolvedValueOnce('envVariable');

      const utils = await import('../../../src/utils');
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      await promptForInputs();

      const [rawDocArgs, outputDirArgs, publicKeyArgs] = (prompts.input as any).mock.calls.map(
        (c: any[]) => c[0],
      );

      expect(rawDocArgs.required).toBe(true);
      expect(rawDocArgs.validate('')).toBe('Document path is required');
      expect(rawDocArgs.validate('   ')).toBe('Document path is required');
      expect(rawDocArgs.validate('./raw-documents')).toBe(true);

      expect(outputDirArgs.default).toBe('.');

      expect(publicKeyArgs.required).toBe(true);
      expect(publicKeyArgs.validate('')).toBe('Public key is required');
      expect(publicKeyArgs.validate('   ')).toBe('Public key is required');
      expect(publicKeyArgs.validate('did:ethr:0x1234#controller')).toBe(true);

      delete process.env.OA_PRIVATE_KEY;
    });

    it('should prompt for private key source with supported choices', async () => {
      process.env.OA_PRIVATE_KEY = 'test-private-key';

      (prompts.input as any)
        .mockResolvedValueOnce('./raw-documents')
        .mockResolvedValueOnce('./output')
        .mockResolvedValueOnce('did:ethr:0x1234#controller');
      (prompts.select as any).mockResolvedValueOnce('envVariable');

      const utils = await import('../../../src/utils');
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      await promptForInputs();

      const selectArgs = (prompts.select as any).mock.calls[0][0];

      expect(selectArgs.message).toContain('Select private key source');
      expect(selectArgs.choices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: 'envVariable' }),
          expect.objectContaining({ value: 'keyFile' }),
          expect.objectContaining({ value: 'keyDirect' }),
        ]),
      );

      delete process.env.OA_PRIVATE_KEY;
    });

    it('should throw error when output path is not a valid directory', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./raw-documents')
        .mockResolvedValueOnce('./invalid-dir')
        .mockResolvedValueOnce('did:ethr:0x1234#controller');

      const utils = await import('../../../src/utils');
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(false);

      await expect(promptForInputs()).rejects.toThrow('Output path is not valid');
    });

    it('should throw error when OA_PRIVATE_KEY environment variable is not set', async () => {
      delete process.env.OA_PRIVATE_KEY;

      (prompts.input as any)
        .mockResolvedValueOnce('./raw-documents')
        .mockResolvedValueOnce('./output')
        .mockResolvedValueOnce('did:ethr:0x1234#controller');
      (prompts.select as any).mockResolvedValueOnce('envVariable');

      const utils = await import('../../../src/utils');
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      await expect(promptForInputs()).rejects.toThrow(
        'OA_PRIVATE_KEY environment variable is not set.',
      );
    });
  });

  describe('signDocuments', () => {
    let getPrivateKeyMock: MockedFunction<any>;
    let documentsInDirectoryMock: MockedFunction<any>;
    let readDocumentFileMock: MockedFunction<any>;
    let writeDocumentToDiskMock: MockedFunction<any>;
    let signOAMock: MockedFunction<any>;
    let signaleSuccessMock: MockedFunction<any>;

    const input: OASignInput = {
      rawDocumentsPath: './raw-documents',
      outputDir: './output',
      publicKey: 'did:ethr:0x1234#controller',
      key: '0xabcdef1234567890',
    };

    beforeEach(async () => {
      const utils = await import('../../../src/utils');
      getPrivateKeyMock = utils.getPrivateKey as MockedFunction<any>;
      documentsInDirectoryMock = utils.documentsInDirectory as MockedFunction<any>;
      readDocumentFileMock = utils.readDocumentFile as MockedFunction<any>;
      writeDocumentToDiskMock = utils.writeDocumentToDisk as MockedFunction<any>;

      const trustvc = await import('@trustvc/trustvc');
      signOAMock = trustvc.signOA as MockedFunction<any>;

      const signale = await import('signale');
      signaleSuccessMock = (signale.default as any).success;
    });

    it('should sign a single document and write to output directory', async () => {
      getPrivateKeyMock.mockReturnValue('0xabcdef1234567890');
      documentsInDirectoryMock.mockResolvedValue(['./raw-documents/document.json']);
      readDocumentFileMock.mockResolvedValue({ data: 'raw document' });
      signOAMock.mockResolvedValue({ data: 'signed document', proof: 'signature' });

      await signDocuments(input);

      expect(getPrivateKeyMock).toHaveBeenCalledWith({
        key: '0xabcdef1234567890',
        keyFile: undefined,
      });
      expect(documentsInDirectoryMock).toHaveBeenCalledWith('./raw-documents');
      expect(readDocumentFileMock).toHaveBeenCalledWith('./raw-documents/document.json');
      expect(signOAMock).toHaveBeenCalledWith(
        { data: 'raw document' },
        {
          private: '0xabcdef1234567890',
          public: 'did:ethr:0x1234#controller',
        },
      );
      expect(writeDocumentToDiskMock).toHaveBeenCalledWith('./output', 'document.json', {
        data: 'signed document',
        proof: 'signature',
      });
      expect(signaleSuccessMock).toHaveBeenCalledWith(
        'Signed document saved: ./output/document.json',
      );
    });

    it('should sign multiple documents and write to output directory', async () => {
      getPrivateKeyMock.mockReturnValue('0xabcdef1234567890');
      documentsInDirectoryMock.mockResolvedValue([
        './raw-documents/doc1.json',
        './raw-documents/doc2.json',
      ]);
      readDocumentFileMock
        .mockResolvedValueOnce({ data: 'raw document 1' })
        .mockResolvedValueOnce({ data: 'raw document 2' });
      signOAMock
        .mockResolvedValueOnce({ data: 'signed document 1', proof: 'signature1' })
        .mockResolvedValueOnce({ data: 'signed document 2', proof: 'signature2' });

      await signDocuments(input);

      expect(documentsInDirectoryMock).toHaveBeenCalledWith('./raw-documents');
      expect(readDocumentFileMock).toHaveBeenCalledTimes(2);
      expect(signOAMock).toHaveBeenCalledTimes(2);
      expect(writeDocumentToDiskMock).toHaveBeenCalledTimes(2);
      expect(signaleSuccessMock).toHaveBeenCalledTimes(2);
    });

    it('should throw error when private key is not specified', async () => {
      getPrivateKeyMock.mockReturnValue(null);

      await expect(signDocuments(input)).rejects.toThrow(
        'Private key is not specified (use key, key-file, or OA_PRIVATE_KEY)',
      );

      expect(documentsInDirectoryMock).not.toHaveBeenCalled();
    });

    it('should throw error when no valid documents found to sign', async () => {
      getPrivateKeyMock.mockReturnValue('0xabcdef1234567890');
      documentsInDirectoryMock.mockResolvedValue([]);

      await expect(signDocuments(input)).rejects.toThrow('No valid documents found to sign');

      expect(readDocumentFileMock).not.toHaveBeenCalled();
      expect(signOAMock).not.toHaveBeenCalled();
    });

    it('should use keyFile when provided instead of key', async () => {
      const inputWithKeyFile: OASignInput = {
        rawDocumentsPath: './raw-documents',
        outputDir: './output',
        publicKey: 'did:ethr:0x1234#controller',
        keyFile: './private-key.txt',
      };

      getPrivateKeyMock.mockReturnValue('0xabcdef1234567890');
      documentsInDirectoryMock.mockResolvedValue(['./raw-documents/document.json']);
      readDocumentFileMock.mockResolvedValue({ data: 'raw document' });
      signOAMock.mockResolvedValue({ data: 'signed document' });

      await signDocuments(inputWithKeyFile);

      expect(getPrivateKeyMock).toHaveBeenCalledWith({
        key: undefined,
        keyFile: './private-key.txt',
      });
    });
  });
});
