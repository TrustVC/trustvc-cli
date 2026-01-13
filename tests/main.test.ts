import * as prompts from '@inquirer/prompts';
import signale from 'signale';
import { beforeEach, describe, it, MockedFunction, vi } from 'vitest';
import { handler as didHandler } from '../src/commands/w3c/did';
import { handler as keyPairHandler } from '../src/commands/w3c/key-pair';
import * as utils from '../src/utils';

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

// Mock dependencies with Vitest
vi.mock('@inquirer/prompts');
vi.mock('../src/utils');
vi.mock('../src/commands/did', async () => {
  const original =
    await vi.importActual<typeof import('../src/commands/w3c/did')>('../src/commands/did');
  return {
    ...original, // Use actual implementations by default
    promptQuestions: original.promptQuestions,
    getIssuedDid: original.getIssuedDid,
    saveIssuedDid: original.saveIssuedDid,
  };
});
vi.mock('../src/commands/key-pair', async () => {
  const original = await vi.importActual<typeof import('../src/commands/w3c/key-pair')>(
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
    let signaleErrorSpy: MockedFunction<typeof signale.error>;

    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetAllMocks();
      vi.restoreAllMocks();

      const issuerModule = await import('@trustvc/trustvc');
      issueDIDSpy = issuerModule.issuer.issueDID as MockedFunction<any>;
      writeFileSpy = vi.spyOn(utils, 'writeFile') as MockedFunction<typeof utils.writeFile>;
      signaleErrorSpy = signale.error as MockedFunction<typeof signale.error>;
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
      expect(writeFileSpy).toHaveBeenNthCalledWith(1, './wellknown.json', expect.any(Object), true);
      expect(writeFileSpy).toHaveBeenNthCalledWith(
        2,
        './didKeyPairs.json',
        expect.any(Object),
        true,
      );
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
      expect(signaleErrorSpy).toHaveBeenCalledWith(
        'Error generating DID token: KeyPair already exists in DID Document',
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
      expect(signaleErrorSpy).toHaveBeenCalledWith('Error generating DID token');
    });
  });

  describe('trustvc key-pair-generation command', () => {
    let generateKeyPairSpy: MockedFunction<any>;
    let writeFileSpy: MockedFunction<typeof utils.writeFile>;
    let signaleErrorSpy: MockedFunction<typeof signale.error>;

    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetAllMocks();
      vi.restoreAllMocks();

      const issuerModule = await import('@trustvc/trustvc');
      generateKeyPairSpy = issuerModule.issuer.generateKeyPair as MockedFunction<any>;
      writeFileSpy = vi.spyOn(utils, 'writeFile') as MockedFunction<typeof utils.writeFile>;
      signaleErrorSpy = signale.error as MockedFunction<typeof signale.error>;
    });

    it('should generate a new key pair with ecdsa-sd-2023', async ({ expect }) => {
      const input = {
        encAlgo: 'ecdsa-sd-2023',
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
        seedBase58: '',
      });
      expect(writeFileSpy).toHaveBeenCalledWith(
        './keypair.json',
        {
          type: 'Multikey',
          publicKeyMultibase: 'z6MkTest',
          secretKeyMultibase: 'z3uTest',
        },
        true,
      );
      expect(signaleErrorSpy).not.toHaveBeenCalled();
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

      expect(generateKeyPairSpy).toHaveBeenCalledWith({
        type: input.encAlgo,
        seedBase58: input.seedBase58,
      });
      expect(writeFileSpy).toHaveBeenCalledWith(
        './keypair.json',
        {
          type: 'Multikey',
          seedBase58: mockSeed,
          publicKeyMultibase: 'z6MkTest',
          secretKeyMultibase: 'z3uTest',
        },
        true,
      );
      expect(signaleErrorSpy).not.toHaveBeenCalled();
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
      expect(signaleErrorSpy).toHaveBeenCalledWith(
        'Invalid seed provided. Please provide a valid seed in base58 format.',
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
      expect(signaleErrorSpy).toHaveBeenCalledWith('Invalid file path provided: ./invalid-path');
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
      expect(signaleErrorSpy).toHaveBeenCalledWith('Error generating keypair');
    });
  });
});
