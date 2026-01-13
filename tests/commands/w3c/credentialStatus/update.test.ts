import * as prompts from '@inquirer/prompts';
import { credentialStatus, signW3C } from '@trustvc/trustvc';
import signale from 'signale';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  createSignedCredentialStatus,
  promptQuestions,
} from '../../../../src/commands/w3c/credentialStatus/update';
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
      StatusList: {
        decode: vi.fn().mockResolvedValue({
          encode: vi.fn().mockResolvedValue('encodedList'),
          getStatus: vi.fn().mockReturnValue(false),
          setStatus: vi.fn(),
        }),
      },
      createCredentialStatusPayload: vi.fn(),
    },
  };
});

// Mock global fetch
global.fetch = vi.fn();

describe('credential-status-update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptQuestions', () => {
    it('should fetch and decode existing credential status', async () => {
      const mockCredentialStatusVC = {
        credentialSubject: {
          type: 'BitstringStatusList',
          statusPurpose: 'revocation',
          encodedList: 'mockEncodedList',
        },
      };

      const mockKeypairData = { type: 'Multikey' };

      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockCredentialStatusVC),
      } as any);

      (prompts.input as any)
        .mockResolvedValueOnce('https://example.com/status/1')
        .mockResolvedValueOnce('./didKeyPairs.json')
        .mockResolvedValueOnce('.');
      (prompts.select as any).mockResolvedValueOnce('ecdsa-sd-2023');
      (prompts.confirm as any).mockResolvedValueOnce(false);

      const { isDirectoryValid, readJsonFile } = await import('../../../../src/utils');
      (readJsonFile as MockedFunction<typeof readJsonFile>).mockReturnValue(mockKeypairData);
      (isDirectoryValid as MockedFunction<typeof isDirectoryValid>).mockReturnValue(true);

      const answers = await promptQuestions();

      expect(answers).toBeDefined();
      expect(answers?.hostingUrl).toBe('https://example.com/status/1');
      expect(answers?.type).toBe('BitstringStatusList');
      expect(answers?.purpose).toBe('revocation');
      expect(credentialStatus.StatusList.decode).toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      (prompts.input as any).mockResolvedValueOnce('https://example.com/status/1');

      await expect(promptQuestions()).rejects.toThrow(
        'Invalid URL or credential status not found: https://example.com/status/1',
      );
      expect(signale.error).toHaveBeenCalledWith(
        'Failed to fetch credential status from: https://example.com/status/1',
      );
    });

    it('should return undefined if key pair file is invalid', async () => {
      const mockCredentialStatusVC = {
        credentialSubject: {
          type: 'BitstringStatusList',
          statusPurpose: 'revocation',
          encodedList: 'mockEncodedList',
        },
      };

      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockCredentialStatusVC),
      } as any);

      (prompts.input as any)
        .mockResolvedValueOnce('https://example.com/status/1')
        .mockResolvedValueOnce('./invalid.json');

      const { readJsonFile } = await import('../../../../src/utils');
      (readJsonFile as MockedFunction<typeof readJsonFile>).mockImplementation(() => {
        throw new Error('File not found');
      });

      const answers = await promptQuestions();

      expect(answers).toBeUndefined();
      expect(signale.error).toHaveBeenCalledWith('Invalid file path provided: ./invalid.json');
    });

    it('should allow updating status list indices', async () => {
      const mockCredentialStatusVC = {
        credentialSubject: {
          type: 'BitstringStatusList',
          statusPurpose: 'revocation',
          encodedList: 'mockEncodedList',
        },
      };

      const mockKeypairData = { type: 'Multikey' };
      const mockStatusList = {
        encode: vi.fn().mockResolvedValue('encodedList'),
        getStatus: vi.fn().mockReturnValue(false),
        setStatus: vi.fn(),
      };

      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockCredentialStatusVC),
      } as any);

      (credentialStatus.StatusList.decode as MockedFunction<any>).mockResolvedValue(mockStatusList);

      (prompts.input as any)
        .mockResolvedValueOnce('https://example.com/status/1')
        .mockResolvedValueOnce('./didKeyPairs.json')
        .mockResolvedValueOnce('.');
      (prompts.select as any).mockResolvedValueOnce('ecdsa-sd-2023').mockResolvedValueOnce(true);
      (prompts.confirm as any).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      (prompts.number as any).mockResolvedValueOnce(5);

      const { isDirectoryValid, readJsonFile } = await import('../../../../src/utils');
      (readJsonFile as MockedFunction<typeof readJsonFile>).mockReturnValue(mockKeypairData);
      (isDirectoryValid as MockedFunction<typeof isDirectoryValid>).mockReturnValue(true);

      const answers = await promptQuestions();

      expect(answers).toBeDefined();
      expect(mockStatusList.getStatus).toHaveBeenCalledWith(5);
      expect(mockStatusList.setStatus).toHaveBeenCalledWith(5, true);
    });
  });

  describe('createSignedCredentialStatus', () => {
    it('should create and sign updated credential status', async () => {
      const mockAnswers: CredentialStatusQuestionType = {
        type: 'BitstringStatusList',
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

    it('should throw error for invalid credential status type', async () => {
      const mockAnswers: CredentialStatusQuestionType = {
        type: 'InvalidType',
        keypairData: { type: 'Multikey' },
        cryptoSuite: 'ecdsa-sd-2023',
        hostingUrl: 'https://example.com/status/1',
      };

      const result = await createSignedCredentialStatus(mockAnswers);

      expect(result).toBeUndefined();
      expect(signale.error).toHaveBeenCalledWith('Invalid credential status type.');
    });

    it('should handle signing errors', async () => {
      const mockAnswers: CredentialStatusQuestionType = {
        type: 'BitstringStatusList',
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
});
