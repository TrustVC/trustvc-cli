import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import {
  promptForGaslessNominateInputs,
  runNominateGasless,
} from '../../../../src/commands/gasless/title-escrow/nominate';

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
    nominateGasless: vi.fn(),
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
  assertGaslessSupportedNetwork: vi.fn((n: string) => n),
}));

vi.mock('../../../../src/commands/gasless/common', () => ({
  prepareGaslessRun: vi.fn(),
}));

describe('gasless/title-escrow/nominate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('promptForGaslessNominateInputs', () => {
    it('returns correctly mapped answers for valid inputs', async () => {
      const mockInputs = {
        network: 'sepolia',
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        newBeneficiary: '0x0987654321098765432109876543210987654321',
        paymasterAddress: '0x1111111111111111111111111111111111111111',
        remark: 'Test remark',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = { id: mockInputs.documentId, tokenRegistry: mockInputs.tokenRegistry };

      const utils = await import('../../../../src/utils');
      const config = await import('../../../../src/commands/gasless/config');
      (utils.promptAndReadDocument as MockedFunction<any>).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as MockedFunction<any>).mockResolvedValue({
        tokenRegistry: mockInputs.tokenRegistry,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptAddress as MockedFunction<any>)
        .mockResolvedValueOnce(mockInputs.newBeneficiary)
        .mockResolvedValueOnce(mockInputs.paymasterAddress);
      (utils.promptWalletSelection as MockedFunction<any>).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });
      (utils.promptRemark as MockedFunction<any>).mockResolvedValue(mockInputs.remark);

      const result = await promptForGaslessNominateInputs();

      expect(config.assertGaslessSupportedNetwork).toHaveBeenCalledWith(mockInputs.network);
      expect(result.network).toBe(mockInputs.network);
      expect(result.tokenRegistryAddress).toBe(mockInputs.tokenRegistry);
      expect(result.tokenId).toBe(mockInputs.tokenId);
      expect(result.newBeneficiary).toBe(mockInputs.newBeneficiary);
      expect(result.paymasterAddress).toBe(mockInputs.paymasterAddress);
      expect(result.remark).toBe(mockInputs.remark);
      expect(result.encryptionKey).toBe(mockInputs.documentId);
      expect(result.encryptedWalletPath).toBe('./wallet.json');
    });

    it('rejects when the resolved network is not gasless-supported', async () => {
      const mockDocument = { id: 'doc-id', tokenRegistry: '0xregistry' };
      const utils = await import('../../../../src/utils');
      const config = await import('../../../../src/commands/gasless/config');
      (utils.promptAndReadDocument as MockedFunction<any>).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as MockedFunction<any>).mockResolvedValue({
        tokenRegistry: '0xregistry',
        tokenId: '0xtokenid',
        network: 'mainnet',
        documentId: 'doc-id',
        registryVersion: 'v5',
      });
      (config.assertGaslessSupportedNetwork as MockedFunction<any>).mockImplementation(() => {
        throw new Error('Gasless transactions are only supported on: sepolia, amoy');
      });

      await expect(promptForGaslessNominateInputs()).rejects.toThrow(
        'Gasless transactions are only supported on: sepolia, amoy',
      );
      expect(utils.promptAddress).not.toHaveBeenCalled();
    });
  });

  describe('runNominateGasless', () => {
    const baseArgs = {
      network: 'sepolia',
      tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
      tokenId: '0xabcdef1234567890',
      newBeneficiary: '0x0987654321098765432109876543210987654321',
      paymasterAddress: '0x1111111111111111111111111111111111111111',
      remark: 'Test remark',
      encryptionKey: 'doc-id',
      encryptedWalletPath: './wallet.json',
    };

    it('runs the gasless nomination and returns the transaction hash', async () => {
      const helpers = await import('../../../../src/commands/helpers');
      const common = await import('../../../../src/commands/gasless/common');
      const trustvc = await import('@trustvc/trustvc');

      const smartAccountClient = {};
      (common.prepareGaslessRun as MockedFunction<any>).mockResolvedValue({
        network: 'sepolia',
        titleEscrowAddress: '0xescrow',
        callerAddress: '0xcaller',
        smartAccountClient,
      });
      (trustvc.nominateGasless as MockedFunction<any>).mockResolvedValue('0xtxhash');

      const result = await runNominateGasless(baseArgs);

      expect(helpers.validateAndEncryptRemark).toHaveBeenCalledWith(
        baseArgs.remark,
        baseArgs.encryptionKey,
      );
      expect(common.prepareGaslessRun).toHaveBeenCalledWith(
        expect.objectContaining({ ...baseArgs, requiredRoles: ['beneficiary'] }),
      );
      expect(trustvc.nominateGasless).toHaveBeenCalledWith(
        { titleEscrowAddress: '0xescrow' },
        smartAccountClient,
        { newBeneficiaryAddress: baseArgs.newBeneficiary, remarks: baseArgs.remark },
        { id: baseArgs.encryptionKey },
      );
      expect(result).toBe('0xtxhash');
    });

    it('returns undefined and logs the message when prepareGaslessRun rejects with an Error', async () => {
      const common = await import('../../../../src/commands/gasless/common');
      (common.prepareGaslessRun as MockedFunction<any>).mockRejectedValue(
        new Error('not the current beneficiary'),
      );

      const result = await runNominateGasless(baseArgs);

      expect(result).toBeUndefined();
      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith('not the current beneficiary');
    });

    it('returns undefined and logs the raw value when the gasless call rejects with a non-Error', async () => {
      const common = await import('../../../../src/commands/gasless/common');
      const trustvc = await import('@trustvc/trustvc');

      (common.prepareGaslessRun as MockedFunction<any>).mockResolvedValue({
        network: 'sepolia',
        titleEscrowAddress: '0xescrow',
        callerAddress: '0xcaller',
        smartAccountClient: {},
      });
      (trustvc.nominateGasless as MockedFunction<any>).mockRejectedValue('raw failure');

      const result = await runNominateGasless(baseArgs);

      expect(result).toBeUndefined();
      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith('raw failure');
    });
  });
});
