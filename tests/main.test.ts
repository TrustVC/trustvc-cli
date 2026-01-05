import * as prompts from '@inquirer/prompts';
import chalk from 'chalk';
import { beforeEach, describe, it, MockedFunction, vi } from 'vitest';
import { handler as didHandler } from '../src/commands/did';
import { handler as keyPairHandler } from '../src/commands/key-pair';
import * as utils from '../src/utils';

// Mock dependencies with Vitest
vi.mock('@inquirer/prompts');
vi.mock('../src/utils');
vi.mock('chalk', async () => {
  const originalChalk = await vi.importActual<typeof import('chalk')>('chalk');
  return {
    ...originalChalk,
  };
});
vi.mock('../src/commands/did', async () => {
  const original =
    await vi.importActual<typeof import('../src/commands/did')>('../src/commands/did');
  return {
    ...original, // Use actual implementations by default
    promptQuestions: original.promptQuestions,
    getIssuedDid: original.getIssuedDid,
    saveIssuedDid: original.saveIssuedDid,
  };
});
vi.mock('../src/commands/key-pair', async () => {
  const original = await vi.importActual<typeof import('../src/commands/key-pair')>(
    '../src/commands/key-pair',
  );
  return {
    ...original, // Use actual implementations by default
    promptQuestions: original.promptQuestions,
    generateAndSaveKeyPair: original.generateAndSaveKeyPair,
  };
});
vi.mock('@trustvc/trustvc', async () => {
  const original = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...original,
    issuer: {
      ...original.issuer,
      issueDID: vi.fn(),
      generateKeyPair: vi.fn(),
    },
  };
});

describe('trustvc-cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('trustvc did-web command', () => {
    let issueDIDSpy: MockedFunction<any>;
    let writeFileSpy: MockedFunction<typeof utils.writeFile>;
    let consoleErrorSpy: MockedFunction<typeof console.error>;

    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetAllMocks();
      vi.restoreAllMocks();

      const issuerModule = await import('@trustvc/trustvc');
      issueDIDSpy = issuerModule.issuer.issueDID as MockedFunction<any>;
      writeFileSpy = vi.spyOn(utils, 'writeFile') as MockedFunction<typeof utils.writeFile>;
      consoleErrorSpy = vi.spyOn(console, 'error') as MockedFunction<typeof console.error>;
    });

    it('should generate a new DID token file', async ({ expect }) => {
      const mockKeypairData = {
        domain: 'https://example.com',
      };
      const input = {
        keyPairPath: './keypair.json',
        cryptoSuite: 'ecdsa-sd-2023',
        domainName: 'https://example.com',
        outputPath: '.',
      };

      (prompts.input as any)
        .mockResolvedValueOnce(input.keyPairPath)
        .mockResolvedValueOnce(input.domainName)
        .mockResolvedValueOnce(input.outputPath);
      (prompts.select as any).mockResolvedValueOnce(input.cryptoSuite);

      (utils.readJsonFile as MockedFunction<typeof utils.readJsonFile>).mockReturnValueOnce(
        mockKeypairData,
      );
      (utils.isDirectoryValid as MockedFunction<typeof utils.isDirectoryValid>).mockReturnValue(
        true,
      );

      // Mock the issueDID function to return expected structure
      issueDIDSpy.mockResolvedValue({
        wellKnownDid: {
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: 'did:web:example.com',
          verificationMethod: [
            {
              id: 'did:web:example.com#key-1',
              type: 'Multikey',
              controller: 'did:web:example.com',
              publicKeyMultibase: 'z6MkTest',
            },
          ],
        },
        didKeyPairs: {
          id: 'did:web:example.com#key-1',
          type: 'Multikey',
          controller: 'did:web:example.com',
          publicKeyMultibase: 'z6MkTest',
          secretKeyMultibase: 'z3uTest',
        },
      });

      await didHandler();

      expect(issueDIDSpy).toHaveBeenCalled();
      expect(writeFileSpy).toHaveBeenCalledTimes(2);
      expect(writeFileSpy).toHaveBeenNthCalledWith(1, './wellknown.json', expect.any(Object));
      expect(writeFileSpy).toHaveBeenNthCalledWith(2, './didKeyPairs.json', expect.any(Object));
    });

    it('should early exit if did already exists', async ({ expect }) => {
      const mockKeypairData = {
        domain: 'https://example.com',
      };
      const input = {
        keyPairPath: './keypair.json',
        cryptoSuite: 'ecdsa-sd-2023',
        domainName: 'https://example.com',
        outputPath: '.',
      };

      (prompts.input as any)
        .mockResolvedValueOnce(input.keyPairPath)
        .mockResolvedValueOnce(input.domainName)
        .mockResolvedValueOnce(input.outputPath);
      (prompts.select as any).mockResolvedValueOnce(input.cryptoSuite);

      (utils.readJsonFile as MockedFunction<typeof utils.readJsonFile>).mockReturnValueOnce(
        mockKeypairData,
      );
      (utils.isDirectoryValid as MockedFunction<typeof utils.isDirectoryValid>).mockReturnValue(
        true,
      );

      issueDIDSpy.mockRejectedValue(new Error('KeyPair already exists'));

      await didHandler();

      expect(issueDIDSpy).toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Error: Error generating DID token: KeyPair already exists in Did Document'),
      );
    });

    it('should early exit if getIssuedDid throws error', async ({ expect }) => {
      const mockKeypairData = {
        domain: 'https://example.com',
      };
      const input = {
        keyPairPath: './keypair.json',
        cryptoSuite: 'ecdsa-sd-2023',
        domainName: 'https://example.com',
        outputPath: '.',
      };

      (prompts.input as any)
        .mockResolvedValueOnce(input.keyPairPath)
        .mockResolvedValueOnce(input.domainName)
        .mockResolvedValueOnce(input.outputPath);
      (prompts.select as any).mockResolvedValueOnce(input.cryptoSuite);

      (utils.readJsonFile as MockedFunction<typeof utils.readJsonFile>).mockReturnValueOnce(
        mockKeypairData,
      );
      (utils.isDirectoryValid as MockedFunction<typeof utils.isDirectoryValid>).mockReturnValue(
        true,
      );

      issueDIDSpy.mockRejectedValue(new Error('Some error'));

      await didHandler();

      expect(issueDIDSpy).toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Error: Error generating DID token'));
    });
  });

  describe('trustvc key-pair-generation command', () => {
    let generateKeyPairSpy: MockedFunction<any>;
    let writeFileSpy: MockedFunction<typeof utils.writeFile>;
    let consoleErrorSpy: MockedFunction<typeof console.error>;
    let consoleLogSpy: MockedFunction<typeof console.log>;

    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetAllMocks();
      vi.restoreAllMocks();

      const issuerModule = await import('@trustvc/trustvc');
      generateKeyPairSpy = issuerModule.issuer.generateKeyPair as MockedFunction<any>;
      writeFileSpy = vi.spyOn(utils, 'writeFile') as MockedFunction<typeof utils.writeFile>;
      consoleErrorSpy = vi.spyOn(console, 'error') as MockedFunction<typeof console.error>;
      consoleLogSpy = vi.spyOn(console, 'log') as MockedFunction<typeof console.log>;
    });

    it('should generate a new key pair with ecdsa-sd-2023', async ({ expect }) => {
      const input = {
        encAlgo: 'ecdsa-sd-2023',
        seedBase58: '',
        keyPath: '.',
      };

      (prompts.select as any).mockResolvedValueOnce(input.encAlgo);
      (prompts.input as any).mockResolvedValueOnce(input.keyPath);

      (utils.isDirectoryValid as MockedFunction<typeof utils.isDirectoryValid>).mockReturnValue(
        true,
      );

      generateKeyPairSpy.mockResolvedValue({
        type: 'Multikey',
        publicKeyMultibase: 'z6MkTest',
        secretKeyMultibase: 'z3uTest',
      });

      await keyPairHandler();

      expect(generateKeyPairSpy).toHaveBeenCalledWith({
        type: input.encAlgo,
        seedBase58: input.seedBase58,
      });
      expect(writeFileSpy).toHaveBeenCalledWith('./keypair.json', {
        type: 'Multikey',
        publicKeyMultibase: 'z6MkTest',
        secretKeyMultibase: 'z3uTest',
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should generate a new key pair with bbs-2023 and seed', async ({ expect }) => {
      const mockSeed = 'FVj12jBiBUqYFaEUkTuwAD73p9Hx5NzCJBge74nTguQN';
      const input = {
        encAlgo: 'bbs-2023',
        seedBase58: mockSeed,
        keyPath: '.',
      };

      (prompts.select as any).mockResolvedValueOnce(input.encAlgo);
      (prompts.input as any)
        .mockResolvedValueOnce(input.seedBase58)
        .mockResolvedValueOnce(input.keyPath);

      (utils.isDirectoryValid as MockedFunction<typeof utils.isDirectoryValid>).mockReturnValue(
        true,
      );

      generateKeyPairSpy.mockResolvedValue({
        type: 'Multikey',
        seedBase58: mockSeed,
        publicKeyMultibase: 'z6MkTest',
        secretKeyMultibase: 'z3uTest',
      });

      await keyPairHandler();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.blue('Generating keys from provided seed...'),
      );
      expect(generateKeyPairSpy).toHaveBeenCalledWith({
        type: input.encAlgo,
        seedBase58: input.seedBase58,
      });
      expect(writeFileSpy).toHaveBeenCalledWith('./keypair.json', {
        type: 'Multikey',
        seedBase58: mockSeed,
        publicKeyMultibase: 'z6MkTest',
        secretKeyMultibase: 'z3uTest',
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle invalid seed error', async ({ expect }) => {
      const input = {
        encAlgo: 'bbs-2023',
        seedBase58: 'invalid seed',
        keyPath: '.',
      };

      (prompts.select as any).mockResolvedValueOnce(input.encAlgo);
      (prompts.input as any)
        .mockResolvedValueOnce(input.seedBase58)
        .mockResolvedValueOnce(input.keyPath);

      (utils.isDirectoryValid as MockedFunction<typeof utils.isDirectoryValid>).mockReturnValue(
        true,
      );

      generateKeyPairSpy.mockRejectedValue(new Error('Non-base58btc character'));

      await keyPairHandler();

      expect(generateKeyPairSpy).toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Error: Invalid seed provided. Please provide a valid seed in base58 format.'),
      );
    });

    it('should handle invalid directory path', async ({ expect }) => {
      const input = {
        encAlgo: 'ecdsa-sd-2023',
        seedBase58: '',
        keyPath: './invalid-path',
      };

      (prompts.select as any).mockResolvedValueOnce(input.encAlgo);
      (prompts.input as any).mockResolvedValueOnce(input.keyPath);

      (utils.isDirectoryValid as MockedFunction<typeof utils.isDirectoryValid>).mockReturnValue(
        false,
      );

      await keyPairHandler();

      expect(generateKeyPairSpy).not.toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        chalk.red('Error: Invalid file path provided: ./invalid-path'),
      );
    });

    it('should handle generic key generation error', async ({ expect }) => {
      const input = {
        encAlgo: 'ecdsa-sd-2023',
        seedBase58: '',
        keyPath: '.',
      };

      (prompts.select as any).mockResolvedValueOnce(input.encAlgo);
      (prompts.input as any).mockResolvedValueOnce(input.keyPath);

      (utils.isDirectoryValid as MockedFunction<typeof utils.isDirectoryValid>).mockReturnValue(
        true,
      );

      generateKeyPairSpy.mockRejectedValue(new Error('Generation failed'));

      await keyPairHandler();

      expect(generateKeyPairSpy).toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Error: Error generating keypair'));
    });
  });
});
