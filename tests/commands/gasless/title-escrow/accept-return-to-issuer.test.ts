import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import {
  promptForGaslessAcceptReturnToIssuerInputs,
  runAcceptReturnToIssuerGasless,
} from '../../../../src/commands/gasless/title-escrow/accept-return-to-issuer';
import { TokenRegistryReturnedDocumentGaslessCommand } from '../../../../src/commands/gasless/types';

vi.mock('signale', async (importOriginal) => {
  const originalSignale = await importOriginal<typeof import('signale')>();
  return {
    ...originalSignale,
    Signale: class MockSignale {
      await = vi.fn();
      success = vi.fn();
      error = vi.fn();
      info = vi.fn();
      warn = vi.fn();
      constructor() {}
    },
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    default: {
      await: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  };
});

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    acceptReturnedGasless: vi.fn(),
  };
});

vi.mock('../../../../src/utils', async (importOriginal) => {
  const originalUtils = await importOriginal<typeof import('../../../../src/utils')>();
  return {
    ...originalUtils,
    extractDocumentInfo: vi.fn(),
    getErrorMessage: vi.fn((e: any) => (e instanceof Error ? e.message : String(e))),
    getEtherscanAddress: vi.fn(() => 'https://etherscan.io'),
    promptAddress: vi.fn(),
    promptAndReadDocument: vi.fn(),
    promptRemark: vi.fn(),
    promptWalletSelection: vi.fn(),
    verifyDocumentSignature: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../../../src/commands/helpers', () => ({
  validateAndEncryptRemark: vi.fn().mockReturnValue('encrypted-remark'),
}));

vi.mock('../../../../src/commands/gasless/config', () => ({
  assertGaslessSupportedNetwork: vi.fn((n) => n),
}));

vi.mock('../../../../src/commands/gasless/common', () => ({
  prepareGaslessRegistryRun: vi.fn(),
}));

describe('gasless/title-escrow/accept-return-to-issuer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('promptForGaslessAcceptReturnToIssuerInputs', () => {
    it('should return correct answers for valid inputs', async () => {
      const mockInputs = {
        network: 'sepolia',
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        paymasterAddress: '0x9999999999999999999999999999999999999999',
        remark: 'Test remark',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.tokenRegistry,
      };

      const utils = await import('../../../../src/utils');
      const config = await import('../../../../src/commands/gasless/config');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.verifyDocumentSignature as any).mockResolvedValue(undefined);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.tokenRegistry,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptAddress as any).mockResolvedValue(mockInputs.paymasterAddress);
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });
      (utils.promptRemark as any).mockResolvedValue(mockInputs.remark);
      (config.assertGaslessSupportedNetwork as any).mockImplementation((n: string) => n);

      const result = await promptForGaslessAcceptReturnToIssuerInputs();

      expect(result.network).toBe(mockInputs.network);
      expect(result.tokenRegistryAddress).toBe(mockInputs.tokenRegistry);
      expect(result.tokenId).toBe(mockInputs.tokenId);
      expect(result.paymasterAddress).toBe(mockInputs.paymasterAddress);
      expect(result.remark).toBe(mockInputs.remark);
      expect(result.encryptionKey).toBe(mockInputs.documentId);
      expect((result as any).encryptedWalletPath).toBe('./wallet.json');
    });

    it('should reject when network is not gasless-supported', async () => {
      const mockDocument = { id: 'doc-id', tokenRegistry: '0xabc' };
      const utils = await import('../../../../src/utils');
      const config = await import('../../../../src/commands/gasless/config');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.verifyDocumentSignature as any).mockResolvedValue(undefined);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: '0xabc',
        tokenId: '0x1',
        network: 'unsupported-network',
        documentId: 'doc-id',
        registryVersion: 'v5',
      });
      (config.assertGaslessSupportedNetwork as any).mockImplementation(() => {
        throw new Error('Unsupported network');
      });

      await expect(promptForGaslessAcceptReturnToIssuerInputs()).rejects.toThrow(
        'Unsupported network',
      );
    });
  });

  describe('runAcceptReturnToIssuerGasless', () => {
    let acceptReturnedGaslessMock: MockedFunction<any>;
    let prepareGaslessRegistryRunMock: MockedFunction<any>;

    const baseArgs: TokenRegistryReturnedDocumentGaslessCommand = {
      network: 'sepolia',
      tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
      tokenId: '0xabcdef1234567890',
      paymasterAddress: '0x9999999999999999999999999999999999999999',
      remark: 'Test remark',
      encryptionKey: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
    };

    beforeEach(async () => {
      vi.clearAllMocks();

      const trustvcModule = await import('@trustvc/trustvc');
      acceptReturnedGaslessMock = trustvcModule.acceptReturnedGasless as MockedFunction<any>;

      const commonModule = await import('../../../../src/commands/gasless/common');
      prepareGaslessRegistryRunMock = commonModule.prepareGaslessRegistryRun as MockedFunction<any>;
    });

    it('should successfully run the gasless accept return to issuer flow', async () => {
      prepareGaslessRegistryRunMock.mockResolvedValue({
        network: 'sepolia',
        callerAddress: '0xCaller',
        smartAccountClient: { id: 'client' },
      });
      acceptReturnedGaslessMock.mockResolvedValue('0xtxhash');

      const result = await runAcceptReturnToIssuerGasless(baseArgs);

      const helpers = await import('../../../../src/commands/helpers');
      expect(helpers.validateAndEncryptRemark).toHaveBeenCalledWith(
        baseArgs.remark,
        baseArgs.encryptionKey,
      );

      expect(prepareGaslessRegistryRunMock).toHaveBeenCalledWith(baseArgs);
      expect(prepareGaslessRegistryRunMock).toHaveBeenCalledWith(
        expect.not.objectContaining({ requiredRoles: expect.anything() }),
      );

      expect(acceptReturnedGaslessMock).toHaveBeenCalledWith(
        { tokenRegistryAddress: baseArgs.tokenRegistryAddress },
        { id: 'client' },
        { tokenId: baseArgs.tokenId, remarks: baseArgs.remark },
        { id: baseArgs.encryptionKey },
      );

      expect(result).toBe('0xtxhash');
    });

    it('should return undefined and log error message when prepareGaslessRegistryRun rejects with an Error', async () => {
      prepareGaslessRegistryRunMock.mockRejectedValue(new Error('not eligible'));

      const result = await runAcceptReturnToIssuerGasless(baseArgs);

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith('not eligible');
      expect(result).toBeUndefined();
    });

    it('should return undefined and log error message when the gasless call rejects with a non-Error', async () => {
      prepareGaslessRegistryRunMock.mockResolvedValue({
        network: 'sepolia',
        callerAddress: '0xCaller',
        smartAccountClient: { id: 'client' },
      });
      acceptReturnedGaslessMock.mockRejectedValue('String error message');

      const result = await runAcceptReturnToIssuerGasless(baseArgs);

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith('String error message');
      expect(result).toBeUndefined();
    });
  });
});
