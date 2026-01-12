import * as prompts from '@inquirer/prompts';
import { credentialStatus, signW3C } from '@trustvc/trustvc';
import signale from 'signale';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  createSignedCredentialStatus,
  promptQuestions,
  saveSignedCredentialStatus,
} from '../../../../src/commands/w3c/credentialStatus/create';
import { CredentialStatusQuestionType } from '../../../../src/types';

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

vi.mock('@inquirer/prompts');
vi.mock('fs', async () => {
  const originalFs = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...originalFs,
  };
});
vi.mock('../../../../src/utils', async () => {
  const originalUtils =
    await vi.importActual<typeof import('../../../../src/utils')>('../../../../src/utils');
  return {
    ...originalUtils,
    isDirectoryValid: vi.fn(),
    readJsonFile: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock('@trustvc/trustvc', async () => {
  const original = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...original,
    signW3C: vi.fn(),
    credentialStatus: {
      ...original.credentialStatus,
      StatusList: vi.fn().mockImplementation(() => ({
        encode: vi.fn().mockResolvedValue('encodedList'),
        getStatus: vi.fn().mockReturnValue(false),
        setStatus: vi.fn(),
      })),
      createCredentialStatusPayload: vi.fn(),
    },
  };
});

describe('credential-status-create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptQuestions', () => {
    it('should prompt for all required inputs', async () => {
      const mockKeypairData = { type: 'Multikey' };
      const input = {
        keyPairPath: './didKeyPairs.json',
        cryptoSuite: 'ecdsa-sd-2023',
        hostingUrl: 'https://example.com/status/1',
        outputPath: '.',
        length: 131072,
        purpose: 'revocation',
      };

      (prompts.input as any)
        .mockResolvedValueOnce(input.keyPairPath)
        .mockResolvedValueOnce(input.hostingUrl)
        .mockResolvedValueOnce(input.outputPath)
        .mockResolvedValueOnce(input.length);
      (prompts.select as any)
        .mockResolvedValueOnce(input.cryptoSuite)
        .mockResolvedValueOnce(input.purpose);
      (prompts.confirm as any).mockResolvedValueOnce(false);

      const { isDirectoryValid, readJsonFile } = await import('../../../../src/utils');
      (readJsonFile as MockedFunction<typeof readJsonFile>).mockReturnValue(mockKeypairData);
      (isDirectoryValid as MockedFunction<typeof isDirectoryValid>).mockReturnValue(true);

      const answers = await promptQuestions();

      expect(answers).toBeDefined();
      expect(answers?.keyPairPath).toBe(input.keyPairPath);
      expect(answers?.cryptoSuite).toBe(input.cryptoSuite);
      expect(answers?.hostingUrl).toBe(input.hostingUrl);
      expect(answers?.outputPath).toBe(input.outputPath);
    });

    it('should return undefined if key pair file is invalid', async () => {
      (prompts.input as any).mockResolvedValueOnce('./invalid.json');

      const { readJsonFile } = await import('../../../../src/utils');
      (readJsonFile as MockedFunction<typeof readJsonFile>).mockImplementation(() => {
        throw new Error('File not found');
      });

      const answers = await promptQuestions();

      expect(answers).toBeUndefined();
      expect(signale.error).toHaveBeenCalledWith('Invalid file path provided: ./invalid.json');
    });

    it('should throw error if directory is invalid', async () => {
      const mockKeypairData = { type: 'Multikey' };

      (prompts.input as any)
        .mockResolvedValueOnce('./didKeyPairs.json')
        .mockResolvedValueOnce('https://example.com/status/1')
        .mockResolvedValueOnce('./invalid-dir');
      (prompts.select as any).mockResolvedValueOnce('ecdsa-sd-2023');

      const { isDirectoryValid, readJsonFile } = await import('../../../../src/utils');
      (readJsonFile as MockedFunction<typeof readJsonFile>).mockReturnValue(mockKeypairData);
      (isDirectoryValid as MockedFunction<typeof isDirectoryValid>).mockReturnValue(false);

      await expect(promptQuestions()).rejects.toThrow('Invalid directory path: ./invalid-dir');
    });
  });

  describe('createSignedCredentialStatus', () => {
    it('should create and sign credential status successfully', async () => {
      const mockAnswers: CredentialStatusQuestionType = {
        keypairData: { type: 'Multikey' },
        cryptoSuite: 'ecdsa-sd-2023',
        hostingUrl: 'https://example.com/status/1',
        purpose: 'revocation',
        credentialStatus: {
          encode: vi.fn().mockResolvedValue('encodedList'),
        } as any,
      };

      const mockPayload = { id: 'test' };
      const mockSigned = { proof: 'signature' };

      (credentialStatus.createCredentialStatusPayload as MockedFunction<any>).mockResolvedValue(
        mockPayload,
      );
      (signW3C as MockedFunction<typeof signW3C>).mockResolvedValue({
        signed: mockSigned,
        error: null,
      } as any);

      const result = await createSignedCredentialStatus(mockAnswers);

      expect(result).toEqual(mockSigned);
      expect(credentialStatus.createCredentialStatusPayload).toHaveBeenCalled();
      expect(signW3C).toHaveBeenCalledWith(mockPayload, mockAnswers.keypairData, 'ecdsa-sd-2023');
    });

    it('should handle signing errors', async () => {
      const mockAnswers: CredentialStatusQuestionType = {
        keypairData: { type: 'Multikey' },
        cryptoSuite: 'ecdsa-sd-2023',
        hostingUrl: 'https://example.com/status/1',
        purpose: 'revocation',
        credentialStatus: {
          encode: vi.fn().mockResolvedValue('encodedList'),
        } as any,
      };

      (credentialStatus.createCredentialStatusPayload as MockedFunction<any>).mockResolvedValue({});
      (signW3C as MockedFunction<typeof signW3C>).mockResolvedValue({
        signed: null,
        error: 'Signing failed',
      } as any);

      const result = await createSignedCredentialStatus(mockAnswers);

      expect(result).toBeUndefined();
      expect(signale.error).toHaveBeenCalledWith('Signing failed');
    });
  });

  describe('saveSignedCredentialStatus', () => {
    it('should write credential status file successfully', async () => {
      vi.clearAllMocks();
      const signaleSuccessSpy = signale.success as MockedFunction<typeof signale.success>;
      const signaleInfoSpy = signale.info as MockedFunction<typeof signale.info>;
      const signaleWarnSpy = signale.warn as MockedFunction<typeof signale.warn>;

      const mockSignedVC = { proof: 'signature' } as any;

      await saveSignedCredentialStatus(mockSignedVC, '.');

      expect(signaleSuccessSpy).toHaveBeenCalledWith(
        'Generated credential status list successfully',
      );
      expect(signaleInfoSpy).toHaveBeenCalledWith('Saved to: ./credentialStatus.json');
      expect(signaleWarnSpy).toHaveBeenCalledWith(
        'IMPORTANT: Host this file at the URL you specified!',
      );
    });
  });
});
