import * as prompts from '@inquirer/prompts';
import { issuer } from '@trustvc/trustvc';
import fs from 'fs';
import signale from 'signale';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { generateAndSaveKeyPair, promptQuestions } from '../../../src/commands/w3c/key-pair';
import { KeyPairGenerateInput } from '../../../src/types';

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
    // This is required, otherwise mocks that use writeFile won't work
    promises: {
      writeFile: vi.fn().mockResolvedValue({}),
    },
  };
});

// GLOBAL CONSTANTS
const mockSeed = 'FVj12jBiBUqYFaEUkTuwAD73p9Hx5NzCJBge74nTguQN';

describe('key-pair', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('promptQuestions', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should promptQuestions successfully with type bbs-2023', async () => {
      const input: KeyPairGenerateInput = {
        encAlgo: 'bbs-2023',
        seedBase58: mockSeed,
        keyPath: './valid-dir',
      };
      // Automatically keys in "user input" that inquirer will receive
      (prompts.select as any).mockResolvedValueOnce(input.encAlgo);
      (prompts.input as any)
        .mockResolvedValueOnce(input.seedBase58)
        .mockResolvedValueOnce(input.keyPath);
      vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
        return [];
      });

      const answers: any = await promptQuestions();

      expect(answers.encAlgo).toBe('bbs-2023');
      expect(answers.seedBase58).toBe(mockSeed);
      expect(answers.keyPath).toBe('./valid-dir');
      expect(prompts.input).toHaveBeenCalledTimes(2);
    });

    it('should promptQuestions successfully with type ecdsa-sd-2023', async () => {
      const input: KeyPairGenerateInput = {
        encAlgo: 'ecdsa-sd-2023',
        seedBase58: '',
        keyPath: './valid-dir',
      };
      // Automatically keys in "user input" that inquirer will receive
      (prompts.select as any).mockResolvedValueOnce(input.encAlgo);
      (prompts.input as any).mockResolvedValueOnce(input.keyPath);
      vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
        return [];
      });

      const answers: any = await promptQuestions();

      expect(answers.encAlgo).toBe('ecdsa-sd-2023');
      expect(answers.seedBase58).toBe('');
      expect(answers.keyPath).toBe('./valid-dir');
      expect(prompts.input).toHaveBeenCalledTimes(1); // Only keyPath, no seed for ECDSA
    });

    it('should fail promptQuestions when given invalid file path', async () => {
      const input: KeyPairGenerateInput = {
        encAlgo: 'bbs-2023',
        seedBase58: mockSeed,
        keyPath: './/invalid-file-path',
      };
      // Automatically keys in "user input" that inquirer will receive
      (prompts.select as any).mockResolvedValueOnce(input.encAlgo);
      (prompts.input as any)
        .mockResolvedValueOnce(input.seedBase58)
        .mockResolvedValueOnce(input.keyPath);
      const readDirMock = vi.spyOn(fs, 'readdirSync');
      readDirMock.mockImplementation(() => {
        throw new Error();
      });

      await expect(promptQuestions()).rejects.toThrowError(
        `Invalid file path provided: ${input.keyPath}`,
      );
    });
  });

  describe('generateAndSaveKeyPair with bbs-2023', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should successfully generate and save keypair file', async () => {
      const input: KeyPairGenerateInput = {
        encAlgo: 'bbs-2023',
        seedBase58: '',
        keyPath: '.',
      };

      vi.clearAllMocks();
      const signaleSuccessSpy = signale.success as MockedFunction<typeof signale.success>;
      const signaleInfoSpy = signale.info as MockedFunction<typeof signale.info>;
      const signaleWarnSpy = signale.warn as MockedFunction<typeof signale.warn>;
      const writeFileMock = vi.spyOn(fs, 'writeFileSync');

      await generateAndSaveKeyPair(input.encAlgo, input.seedBase58, input.keyPath);

      const expectedKeyPath = `${input.keyPath}/keypair.json`;
      expect(signaleSuccessSpy).toHaveBeenCalledWith('Generated key pair successfully');
      expect(signaleInfoSpy).toHaveBeenCalledWith(`Saved to: ${expectedKeyPath}`);
      expect(signaleWarnSpy).toHaveBeenCalledWith(
        'IMPORTANT: Never share this file publicly - it contains secret keys!',
      );
      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const writtendData = JSON.parse(writeFileMock.mock.calls[0][1].toString());
      expect(writeFileMock).toHaveBeenCalledWith(expectedKeyPath, expect.any(String));
      expect(writtendData).toHaveProperty('type', issuer.VerificationType.Multikey);
      expect(writtendData).toHaveProperty('seedBase58');
      expect(writtendData).toHaveProperty('secretKeyMultibase');
      expect(writtendData).toHaveProperty('publicKeyMultibase');
    });

    it('should use seed to generate and save same keypair file', async () => {
      const input: KeyPairGenerateInput = {
        encAlgo: 'bbs-2023',
        seedBase58: mockSeed,
        keyPath: '.',
      };

      vi.clearAllMocks();
      const signaleInfoSpy = signale.info as MockedFunction<typeof signale.info>;
      const writeFileMock = vi.spyOn(fs, 'writeFileSync');

      await generateAndSaveKeyPair(input.encAlgo, input.seedBase58, input.keyPath);

      expect(signaleInfoSpy).toHaveBeenCalledWith('Generating keys from provided seed...');
      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const writtendData = JSON.parse(writeFileMock.mock.calls[0][1].toString());
      expect(writeFileMock).toHaveBeenCalledWith(
        `${input.keyPath}/keypair.json`,
        expect.any(String),
      );
      expect(writtendData).toHaveProperty('type', issuer.VerificationType.Multikey);
      expect(writtendData).toHaveProperty('seedBase58', mockSeed);
      expect(writtendData).toHaveProperty('secretKeyMultibase');
      expect(writtendData).toHaveProperty('publicKeyMultibase');
    });

    it('should throw error given invalid seed', async () => {
      const input: KeyPairGenerateInput = {
        encAlgo: 'bbs-2023',
        seedBase58: 'a invalid seed',
        keyPath: '.',
      };

      await expect(
        generateAndSaveKeyPair(input.encAlgo, input.seedBase58, input.keyPath),
      ).rejects.toThrowError(
        'Invalid seed provided. Please provide a valid seed in base58 format.',
      );
    });

    it('should throw generic error if generateKeyPair fails', async () => {
      const input: KeyPairGenerateInput = {
        encAlgo: 'bbs-2023',
        seedBase58: '',
        keyPath: '.',
      };
      vi.spyOn(issuer, 'generateKeyPair').mockImplementation(() => {
        throw new Error();
      });
      await expect(
        generateAndSaveKeyPair(input.encAlgo, input.seedBase58, input.keyPath),
      ).rejects.toThrowError('Error generating keypair');
    });

    it('should fail generateAndSaveKeyPair when unable to save file', async () => {
      const input: KeyPairGenerateInput = {
        encAlgo: 'bbs-2023',
        seedBase58: '',
        keyPath: '///invalid-key-path///', // This value doesn't really matter since we mock writeFil to always thro error below
      };
      const writeFileMock = vi.spyOn(fs, 'writeFileSync');
      writeFileMock.mockImplementation(() => {
        throw new Error();
      });

      await expect(
        generateAndSaveKeyPair(input.encAlgo, input.seedBase58, input.keyPath),
      ).rejects.toThrowError(`Unable to write file to ${input.keyPath}/keypair.json`);
    });
  });

  describe('generateAndSaveKeyPair with ecdsa-sd-2023', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should successfully generate and save keypair file', async () => {
      const input: KeyPairGenerateInput = {
        encAlgo: 'ecdsa-sd-2023',
        seedBase58: '',
        keyPath: '.',
      };

      vi.clearAllMocks();
      const signaleSuccessSpy = signale.success as MockedFunction<typeof signale.success>;
      const signaleInfoSpy = signale.info as MockedFunction<typeof signale.info>;
      const signaleWarnSpy = signale.warn as MockedFunction<typeof signale.warn>;
      const writeFileMock = vi.spyOn(fs, 'writeFileSync');

      await generateAndSaveKeyPair(input.encAlgo, input.seedBase58, input.keyPath);

      const expectedKeyPath = `${input.keyPath}/keypair.json`;
      expect(signaleSuccessSpy).toHaveBeenCalledWith('Generated key pair successfully');
      expect(signaleInfoSpy).toHaveBeenCalledWith(`Saved to: ${expectedKeyPath}`);
      expect(signaleWarnSpy).toHaveBeenCalledWith(
        'IMPORTANT: Never share this file publicly - it contains secret keys!',
      );
      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const writtendData = JSON.parse(writeFileMock.mock.calls[0][1].toString());
      expect(writeFileMock).toHaveBeenCalledWith(expectedKeyPath, expect.any(String));
      expect(writtendData).toHaveProperty('type', issuer.VerificationType.Multikey);
      // ECDSA doesn't support seeds, so seedBase58 should not be present
      expect(writtendData).not.toHaveProperty('seedBase58');
      expect(writtendData).toHaveProperty('secretKeyMultibase');
      expect(writtendData).toHaveProperty('publicKeyMultibase');
    });

    it('should throw generic error if generateKeyPair fails', async () => {
      const input: KeyPairGenerateInput = {
        encAlgo: 'ecdsa-sd-2023',
        seedBase58: '',
        keyPath: '.',
      };
      vi.spyOn(issuer, 'generateKeyPair').mockImplementation(() => {
        throw new Error();
      });
      await expect(
        generateAndSaveKeyPair(input.encAlgo, input.seedBase58, input.keyPath),
      ).rejects.toThrowError('Error generating keypair');
    });

    it('should fail generateAndSaveKeyPair when unable to save file', async () => {
      const input: KeyPairGenerateInput = {
        encAlgo: 'ecdsa-sd-2023',
        seedBase58: '',
        keyPath: '///invalid-key-path///',
      };
      const writeFileMock = vi.spyOn(fs, 'writeFileSync');
      writeFileMock.mockImplementation(() => {
        throw new Error();
      });

      await expect(
        generateAndSaveKeyPair(input.encAlgo, input.seedBase58, input.keyPath),
      ).rejects.toThrowError(`Unable to write file to ${input.keyPath}/keypair.json`);
    });
  });
});
