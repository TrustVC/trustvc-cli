import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import {
  promptForPaymasterAdminWalletInputs,
  runPaymasterAdminAction,
} from '../../../../src/commands/gasless/admin/common';

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

vi.mock('../../../../src/utils/wallet', () => ({
  getWalletOrSigner: vi.fn(),
}));

vi.mock('../../../../src/utils', async (importOriginal) => {
  const originalUtils = await importOriginal<typeof import('../../../../src/utils')>();
  return {
    ...originalUtils,
    promptAddress: vi.fn(),
    promptNetworkSelection: vi.fn(),
    promptWalletSelection: vi.fn(),
    getErrorMessage: vi.fn((e: any) => (e instanceof Error ? e.message : String(e))),
    getEtherscanAddress: vi.fn(() => 'https://sepolia.etherscan.io'),
  };
});

describe('gasless/admin/common', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForPaymasterAdminWalletInputs', () => {
    it('should resolve with the prompted wallet inputs for a supported network', async () => {
      const utils = await import('../../../../src/utils');
      (utils.promptNetworkSelection as MockedFunction<any>).mockResolvedValue('sepolia');
      (utils.promptAddress as MockedFunction<any>).mockResolvedValue(
        '0x1111111111111111111111111111111111111111',
      );
      (utils.promptWalletSelection as MockedFunction<any>).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });

      const result = await promptForPaymasterAdminWalletInputs();

      expect(result).toEqual({
        network: 'sepolia',
        paymasterAddress: '0x1111111111111111111111111111111111111111',
        encryptedWalletPath: './wallet.json',
        key: undefined,
        keyFile: undefined,
      });
    });

    it('should resolve with an amoy network', async () => {
      const utils = await import('../../../../src/utils');
      (utils.promptNetworkSelection as MockedFunction<any>).mockResolvedValue('amoy');
      (utils.promptAddress as MockedFunction<any>).mockResolvedValue(
        '0x2222222222222222222222222222222222222222',
      );
      (utils.promptWalletSelection as MockedFunction<any>).mockResolvedValue({
        key: '0xprivatekey',
      });

      const result = await promptForPaymasterAdminWalletInputs();

      expect(result.network).toBe('amoy');
      expect(result.key).toBe('0xprivatekey');
    });

    it('should reject when the network is not gasless-supported', async () => {
      const utils = await import('../../../../src/utils');
      (utils.promptNetworkSelection as MockedFunction<any>).mockResolvedValue('mainnet');

      await expect(promptForPaymasterAdminWalletInputs()).rejects.toThrow(
        /Gasless transactions are only supported on/,
      );

      expect(utils.promptAddress).not.toHaveBeenCalled();
      expect(utils.promptWalletSelection).not.toHaveBeenCalled();
    });
  });

  describe('runPaymasterAdminAction', () => {
    let getWalletOrSignerMock: MockedFunction<any>;
    let mockWallet: any;

    beforeEach(async () => {
      const walletModule = await import('../../../../src/utils/wallet');
      getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;
      mockWallet = { getAddress: vi.fn().mockResolvedValue('0xfrom') };
      getWalletOrSignerMock.mockResolvedValue(mockWallet);

      const utils = await import('../../../../src/utils');
      (utils.getErrorMessage as MockedFunction<any>).mockImplementation((e: any) =>
        e instanceof Error ? e.message : String(e),
      );
      (utils.getEtherscanAddress as MockedFunction<any>).mockReturnValue(
        'https://sepolia.etherscan.io',
      );
    });

    it('should resolve with the tx hash and report success/info on a successful execute', async () => {
      const execute = vi.fn().mockResolvedValue('0xtxhash');

      const result = await runPaymasterAdminAction({
        network: 'sepolia',
        paymasterAddress: '0xpaymaster',
        actionLabel: 'Doing thing',
        execute,
      });

      expect(result).toBe('0xtxhash');
      expect(execute).toHaveBeenCalledWith(mockWallet);

      const signale = await import('signale');
      expect(signale.success).toHaveBeenCalledWith('Doing thing — done');
      expect(signale.info).toHaveBeenCalled();
    });

    it('should catch an Error thrown by execute, log it, and return undefined', async () => {
      const execute = vi.fn().mockRejectedValue(new Error('execute blew up'));

      const result = await runPaymasterAdminAction({
        network: 'sepolia',
        paymasterAddress: '0xpaymaster',
        actionLabel: 'Doing thing',
        execute,
      });

      expect(result).toBeUndefined();
      const signale = await import('signale');
      expect(signale.error).toHaveBeenCalledWith('execute blew up');
    });

    it('should catch a non-Error rejection from execute, log it, and return undefined', async () => {
      const execute = vi.fn().mockRejectedValue('string failure');

      const result = await runPaymasterAdminAction({
        network: 'sepolia',
        paymasterAddress: '0xpaymaster',
        actionLabel: 'Doing thing',
        execute,
      });

      expect(result).toBeUndefined();
      const signale = await import('signale');
      expect(signale.error).toHaveBeenCalledWith('string failure');
    });

    it('should not call execute and should log an error for an unsupported network', async () => {
      const execute = vi.fn();

      const result = await runPaymasterAdminAction({
        network: 'mainnet',
        paymasterAddress: '0xpaymaster',
        actionLabel: 'Doing thing',
        execute,
      });

      expect(result).toBeUndefined();
      expect(execute).not.toHaveBeenCalled();
      const signale = await import('signale');
      expect(signale.error).toHaveBeenCalledWith(
        expect.stringMatching(/Gasless transactions are only supported on/),
      );
    });
  });
});
