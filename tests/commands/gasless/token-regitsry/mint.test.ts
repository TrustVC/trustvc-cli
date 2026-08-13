import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import {
  promptForGaslessMintInputs,
  runMintGasless,
} from '../../../../src/commands/gasless/token-regitsry/mint';
import { TokenRegistryMintGaslessCommand } from '../../../../src/commands/gasless/types';

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
    mintGasless: vi.fn(),
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

vi.mock('../../../../src/utils/wallet', () => ({
  getWalletOrSigner: vi.fn(),
}));

vi.mock('../../../../src/commands/helpers', () => ({
  validateAndEncryptRemark: vi.fn().mockReturnValue('encrypted-remark'),
}));

vi.mock('../../../../src/commands/gasless/config', () => ({
  assertGaslessSupportedNetwork: vi.fn((network: string) => network),
}));

vi.mock('../../../../src/commands/gasless/client', () => ({
  buildGaslessSmartAccountClient: vi.fn(),
}));

vi.mock('../../../../src/commands/gasless/eligibility', () => ({
  checkGaslessMintEligibility: vi.fn(),
}));

describe('gasless/token-registry mint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForGaslessMintInputs', () => {
    it('should return correct answers for valid inputs', async () => {
      const mockInputs = {
        network: 'sepolia',
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
        beneficiary: '0x1111111111111111111111111111111111111111',
        holder: '0x2222222222222222222222222222222222222222',
        paymasterAddress: '0x3333333333333333333333333333333333333333',
        remark: 'Test remark',
      };

      const mockDocument = { id: mockInputs.documentId, tokenRegistry: mockInputs.tokenRegistry };

      const utils = await import('../../../../src/utils');
      const config = await import('../../../../src/commands/gasless/config');

      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.verifyDocumentSignature as any).mockResolvedValue(undefined);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        tokenRegistry: mockInputs.tokenRegistry,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.beneficiary)
        .mockResolvedValueOnce(mockInputs.holder)
        .mockResolvedValueOnce(mockInputs.paymasterAddress);
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });
      (utils.promptRemark as any).mockResolvedValue(mockInputs.remark);

      const result = await promptForGaslessMintInputs();

      expect(config.assertGaslessSupportedNetwork).toHaveBeenCalledWith(mockInputs.network);

      expect(utils.promptAddress).toHaveBeenNthCalledWith(1, 'beneficiary', 'initial recipient');
      expect(utils.promptAddress).toHaveBeenNthCalledWith(2, 'holder', 'initial holder');
      expect(utils.promptAddress).toHaveBeenNthCalledWith(
        3,
        'paymaster',
        'PlatformPaymaster contract that will sponsor this gasless transaction',
      );

      expect(result.network).toBe(mockInputs.network);
      expect(result.tokenRegistryAddress).toBe(mockInputs.tokenRegistry);
      expect(result.tokenId).toBe(mockInputs.tokenId);
      expect(result.beneficiary).toBe(mockInputs.beneficiary);
      expect(result.holder).toBe(mockInputs.holder);
      expect(result.paymasterAddress).toBe(mockInputs.paymasterAddress);
      expect(result.remark).toBe(mockInputs.remark);
      expect(result.encryptionKey).toBe(mockInputs.documentId);
      expect((result as any).encryptedWalletPath).toBe('./wallet.json');
    });

    it('should throw and not prompt for beneficiary/holder/paymaster when network is unsupported', async () => {
      const mockInputs = {
        network: 'mainnet',
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = { id: mockInputs.documentId, tokenRegistry: mockInputs.tokenRegistry };

      const utils = await import('../../../../src/utils');
      const config = await import('../../../../src/commands/gasless/config');

      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.verifyDocumentSignature as any).mockResolvedValue(undefined);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        tokenRegistry: mockInputs.tokenRegistry,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (config.assertGaslessSupportedNetwork as any).mockImplementation(() => {
        throw new Error('Gasless transactions are only supported on: sepolia, amoy.');
      });

      await expect(promptForGaslessMintInputs()).rejects.toThrow(
        'Gasless transactions are only supported on: sepolia, amoy.',
      );

      expect(utils.promptAddress).not.toHaveBeenCalled();
      expect(utils.promptWalletSelection).not.toHaveBeenCalled();
      expect(utils.promptRemark).not.toHaveBeenCalled();
    });
  });

  describe('runMintGasless', () => {
    let mintGaslessMock: MockedFunction<any>;
    let getWalletOrSignerMock: MockedFunction<any>;
    let checkGaslessMintEligibilityMock: MockedFunction<any>;
    let buildGaslessSmartAccountClientMock: MockedFunction<any>;
    let validateAndEncryptRemarkMock: MockedFunction<any>;

    const baseArgs: TokenRegistryMintGaslessCommand = {
      network: 'sepolia',
      tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
      tokenId: '0xabcdef1234567890',
      beneficiary: '0x1111111111111111111111111111111111111111',
      holder: '0x2222222222222222222222222222222222222222',
      paymasterAddress: '0x3333333333333333333333333333333333333333',
      remark: 'Test remark',
      encryptionKey: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      encryptedWalletPath: './wallet.json',
    };

    beforeEach(async () => {
      const utils = await import('../../../../src/utils');
      (utils.getErrorMessage as any).mockImplementation((e: any) =>
        e instanceof Error ? e.message : String(e),
      );

      const trustvcModule = await import('@trustvc/trustvc');
      mintGaslessMock = trustvcModule.mintGasless as MockedFunction<any>;

      const walletModule = await import('../../../../src/utils/wallet');
      getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;

      const eligibilityModule = await import('../../../../src/commands/gasless/eligibility');
      checkGaslessMintEligibilityMock =
        eligibilityModule.checkGaslessMintEligibility as MockedFunction<any>;

      const clientModule = await import('../../../../src/commands/gasless/client');
      buildGaslessSmartAccountClientMock =
        clientModule.buildGaslessSmartAccountClient as MockedFunction<any>;

      const helpersModule = await import('../../../../src/commands/helpers');
      validateAndEncryptRemarkMock = helpersModule.validateAndEncryptRemark as MockedFunction<any>;
      validateAndEncryptRemarkMock.mockReturnValue('encrypted-remark');

      const configModule = await import('../../../../src/commands/gasless/config');
      (configModule.assertGaslessSupportedNetwork as any).mockImplementation(
        (network: string) => network,
      );

      getWalletOrSignerMock.mockResolvedValue({ privateKey: '0xprivatekey' });
      checkGaslessMintEligibilityMock.mockResolvedValue(undefined);
      buildGaslessSmartAccountClientMock.mockResolvedValue({
        smartAccountClient: { sendTransaction: vi.fn() },
        smartAccountAddress: '0xsmartaccount',
      });
      mintGaslessMock.mockResolvedValue('0xtxhash');
    });

    it('should throw and log an error when the resolved wallet has no privateKey (AWS KMS signer)', async () => {
      getWalletOrSignerMock.mockResolvedValue({ provider: {} });

      const result = await runMintGasless(baseArgs);

      expect(result).toBeUndefined();

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith(
        'Gasless transactions require direct access to a private key (encrypted wallet file, --key, --key-file, or OA_PRIVATE_KEY). AWS KMS signers are not supported.',
      );
      expect(checkGaslessMintEligibilityMock).not.toHaveBeenCalled();
      expect(buildGaslessSmartAccountClientMock).not.toHaveBeenCalled();
      expect(mintGaslessMock).not.toHaveBeenCalled();
    });

    it('should successfully run the gasless mint end to end', async () => {
      const result = await runMintGasless(baseArgs);

      expect(validateAndEncryptRemarkMock).toHaveBeenCalledWith(
        baseArgs.remark,
        baseArgs.encryptionKey,
      );

      expect(getWalletOrSignerMock).toHaveBeenCalledWith({
        network: baseArgs.network,
        encryptedWalletPath: baseArgs.encryptedWalletPath,
        key: baseArgs.key,
        keyFile: baseArgs.keyFile,
      });

      expect(checkGaslessMintEligibilityMock).toHaveBeenCalledWith({
        network: baseArgs.network,
        paymasterAddress: baseArgs.paymasterAddress,
        registryAddress: baseArgs.tokenRegistryAddress,
      });

      expect(buildGaslessSmartAccountClientMock).toHaveBeenCalledWith({
        network: baseArgs.network,
        privateKey: '0xprivatekey',
        paymasterAddress: baseArgs.paymasterAddress,
      });

      expect(mintGaslessMock).toHaveBeenCalledWith(
        {
          paymasterAddress: baseArgs.paymasterAddress,
          tokenRegistryAddress: baseArgs.tokenRegistryAddress,
        },
        expect.anything(),
        {
          beneficiaryAddress: baseArgs.beneficiary,
          holderAddress: baseArgs.holder,
          tokenId: baseArgs.tokenId,
          remarks: baseArgs.remark,
        },
        { id: baseArgs.encryptionKey },
      );

      expect(result).toBe('0xtxhash');

      const signaleModule = await import('signale');
      expect(signaleModule.success).toHaveBeenCalledWith(expect.stringContaining(baseArgs.tokenId));
      expect(signaleModule.info).toHaveBeenCalledWith(expect.stringContaining('0xtxhash'));
    });

    it('should log an error and return undefined when eligibility check rejects with an Error', async () => {
      checkGaslessMintEligibilityMock.mockRejectedValue(
        new Error('This account cannot mint gaslessly: not authorized'),
      );

      const result = await runMintGasless(baseArgs);

      expect(result).toBeUndefined();

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith(
        'This account cannot mint gaslessly: not authorized',
      );
      expect(buildGaslessSmartAccountClientMock).not.toHaveBeenCalled();
      expect(mintGaslessMock).not.toHaveBeenCalled();
    });

    it('should log an error and return undefined when mintGasless rejects with a non-Error', async () => {
      mintGaslessMock.mockRejectedValue('String error message');

      const result = await runMintGasless(baseArgs);

      expect(result).toBeUndefined();

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith('String error message');
    });
  });
});
