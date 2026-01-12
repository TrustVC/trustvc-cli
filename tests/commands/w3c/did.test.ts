import * as prompts from '@inquirer/prompts';
import { issuer } from '@trustvc/trustvc';
import signale from 'signale';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { getIssuedDid, promptQuestions, saveIssuedDid } from '../../../src/commands/w3c/did';
import { DidInput } from '../../../src/types';

vi.mock('signale', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    note: vi.fn(),
  },
  Signale: vi.fn().mockImplementation(() => ({
    await: vi.fn(),
    success: vi.fn(),
  })),
}));

vi.mock('@inquirer/prompts');
vi.mock('fs', async () => {
  const originalFs = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...originalFs,
  };
});
vi.mock('../../../src/utils', async () => {
  const originalUtils =
    await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
  return {
    ...originalUtils,
    isDirectoryValid: vi.fn(),
    readJsonFile: vi.fn(),
    writeFile: vi.fn(),
  };
});
vi.mock('@trustvc/trustvc', async () => {
  const originalModule =
    await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...originalModule,
    issuer: {
      ...originalModule.issuer,
      issueDID: vi.fn(),
    },
  };
});

describe('did', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptQuestions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should return correct answers for valid file path', async () => {
      const input: DidInput = {
        keyPairPath: './keypair.json',
        domainName: 'https://example.com',
        outputPath: '.',
      };
      const mockKeypairData = {
        type: 'Multikey',
      };
      (prompts.input as any)
        .mockResolvedValueOnce(input.keyPairPath)
        .mockResolvedValueOnce(input.domainName)
        .mockResolvedValueOnce(input.outputPath);
      (prompts.select as any).mockResolvedValueOnce('ecdsa-sd-2023');

      const utils = await import('../../../src/utils');
      (utils.readJsonFile as MockedFunction<any>).mockReturnValue(mockKeypairData);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      const answers: any = await promptQuestions();

      expect(answers.domainName).toBe(input.domainName);
      expect(answers.outputPath).toBe(input.outputPath);

      const expectedKeypairData = {
        ...mockKeypairData,
        domain: answers.domainName,
      };
      expect(answers.keypairData).toStrictEqual(expectedKeypairData);
    });

    it('should throw error for invalid file path', async () => {
      const input: DidInput = {
        keyPairPath: './/bad-keypair.json',
        domainName: 'https://example.com',
        outputPath: '.',
      };
      (prompts.input as any).mockResolvedValueOnce(input.keyPairPath);

      const utils = await import('../../../src/utils');
      (utils.readJsonFile as MockedFunction<any>).mockImplementation(() => {
        throw new Error(`Invalid key pair file path: ${input.keyPairPath}`);
      });

      await expect(promptQuestions()).rejects.toThrowError(
        `Invalid key pair file path: ${input.keyPairPath}`,
      );
    });

    it('should throw error for invalid keypair file content (not JSON)', async () => {
      const input: DidInput = {
        keyPairPath: './keypair.json',
        domainName: 'https://example.com',
        outputPath: '.',
      };
      (prompts.input as any).mockResolvedValueOnce(input.keyPairPath);

      const utils = await import('../../../src/utils');
      (utils.readJsonFile as MockedFunction<any>).mockImplementation(() => {
        throw new Error(`Invalid key pair file path: ${input.keyPairPath}`);
      });

      await expect(promptQuestions()).rejects.toThrowError(
        `Invalid key pair file path: ${input.keyPairPath}`,
      );
    });

    it('should throw error for invalid outputPath', async () => {
      const input: DidInput = {
        keyPairPath: './keypair.json',
        domainName: 'https://example.com',
        outputPath: './/bad-path',
      };

      (prompts.input as any)
        .mockResolvedValueOnce(input.keyPairPath)
        .mockResolvedValueOnce(input.domainName)
        .mockResolvedValueOnce(input.outputPath);
      (prompts.select as any).mockResolvedValueOnce('ecdsa-sd-2023');

      const utils = await import('../../../src/utils');
      (utils.readJsonFile as MockedFunction<any>).mockReturnValue({ type: 'Multikey' });
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(false);

      await expect(promptQuestions()).rejects.toThrowError(`Output path is not valid`);
    });

    it('should throw error if outputPath is a file', async () => {
      const input: DidInput = {
        keyPairPath: './keypair.json',
        domainName: 'https://example.com',
        outputPath: './somefile.json', // outputPath is a file
      };

      (prompts.input as any)
        .mockResolvedValueOnce(input.keyPairPath)
        .mockResolvedValueOnce(input.domainName)
        .mockResolvedValueOnce(input.outputPath);
      (prompts.select as any).mockResolvedValueOnce('ecdsa-sd-2023');

      const utils = await import('../../../src/utils');
      (utils.readJsonFile as MockedFunction<any>).mockReturnValue({ type: 'Multikey' });
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(false);

      await expect(promptQuestions()).rejects.toThrowError('Output path is not valid');
    });
  });

  describe('getIssuedDid', () => {
    let issueDIDMock: MockedFunction<any>;

    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetAllMocks();

      const issuerModule = await import('@trustvc/trustvc');
      issueDIDMock = issuerModule.issuer.issueDID as MockedFunction<any>;
    });

    it('should throw error if getIssuedDid receives invalid domain name', async () => {
      const mockKeypairData: typeof issuer.IssuedDIDOption = {
        domain: 'bad-domain-name',
      };
      issueDIDMock.mockRejectedValue(new Error('Invalid domain'));
      await expect(getIssuedDid(mockKeypairData)).rejects.toThrowError(
        'Error generating DID token: Invalid domain',
      );
    });

    it('should return did details if domain name is valid', async () => {
      const mockKeypairData: typeof issuer.IssuedDIDOption = {
        domain: 'https://example.com',
      };
      // Basic check, as the actual generation is done by an external library
      issueDIDMock.mockResolvedValue({
        wellKnownDid: { id: 'did:web:example.com' },
        didKeyPairs: { id: 'did:web:example.com#key-1' },
      });
      const result = await getIssuedDid(mockKeypairData);
      expect(result).toHaveProperty('wellKnownDid');
      expect(result).toHaveProperty('didKeyPairs');
    });

    it('should log "KeyPair already exists" error and return undefined', async () => {
      const mockKeypairData: typeof issuer.IssuedDIDOption = {
        domain: 'example.com',
      };
      const errorMessage = 'KeyPair already exists';
      issueDIDMock.mockRejectedValue(new Error(errorMessage));

      await expect(getIssuedDid(mockKeypairData)).rejects.toThrowError(
        'Error generating DID token: KeyPair already exists in DID Document',
      );
    });

    it('should log generic "Error generating DID token" for other errors and return undefined', async () => {
      const mockKeypairData: typeof issuer.IssuedDIDOption = {
        domain: 'example.com',
      };
      issueDIDMock.mockRejectedValue(new Error('Some other internal error'));

      await expect(getIssuedDid(mockKeypairData)).rejects.toThrowError(
        'Error generating DID token',
      );
    });
  });

  describe('saveIssuedDid', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should write files successfully', async () => {
      vi.clearAllMocks();
      const signaleSuccessSpy = signale.success as MockedFunction<typeof signale.success>;
      const signaleInfoSpy = signale.info as MockedFunction<typeof signale.info>;
      const signaleWarnSpy = signale.warn as MockedFunction<typeof signale.warn>;
      const signaleNoteSpy = signale.note as MockedFunction<typeof signale.note>;

      await saveIssuedDid(
        {
          wellKnownDid: null,
          didKeyPairs: null,
        } as any,
        '.',
      );
      expect(signaleSuccessSpy).toHaveBeenCalledWith('Generated DID files successfully');
      expect(signaleInfoSpy).toHaveBeenCalledWith(
        './wellknown.json → Publish at /.well-known/did.json',
      );
      expect(signaleInfoSpy).toHaveBeenCalledWith(
        './didKeyPairs.json → Keep private (contains secret keys)',
      );
      expect(signaleWarnSpy).toHaveBeenCalledWith(
        'IMPORTANT: Never share didKeyPairs.json publicly!',
      );
      expect(signaleNoteSpy).toHaveBeenCalled();
    });

    it('should throw error if writeFile fails', async () => {
      const utils = await import('../../../src/utils');
      (utils.writeFile as MockedFunction<any>).mockImplementation(() => {
        throw new Error('Unable to write file to ./wellknown.json');
      });

      await expect(saveIssuedDid({} as any, '.')).rejects.toThrowError(
        'Unable to write file to ./wellknown.json',
      );
    });
  });
});
