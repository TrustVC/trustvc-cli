import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import { handler } from '../../../../src/commands/gasless/admin/remove-user-from-whitelist';

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
    removeUserFromWhitelist: vi.fn(),
  };
});

vi.mock('../../../../src/utils', async (importOriginal) => {
  const originalUtils = await importOriginal<typeof import('../../../../src/utils')>();
  return {
    ...originalUtils,
    promptAddress: vi.fn(),
  };
});

vi.mock('../../../../src/commands/gasless/admin/common', () => ({
  promptForPaymasterAdminWalletInputs: vi.fn(),
  runPaymasterAdminAction: vi.fn(),
}));

const baseInputs = {
  network: 'sepolia',
  paymasterAddress: '0x1111111111111111111111111111111111111111',
  encryptedWalletPath: './wallet.json',
};

const mockWallet = { getAddress: vi.fn().mockResolvedValue('0xfrom') };

describe('gasless/admin/remove-user-from-whitelist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('handler', () => {
    it('removes the user from the whitelist with the prompted address and returns the tx hash', async () => {
      const commonModule = await import('../../../../src/commands/gasless/admin/common');
      const utilsModule = await import('../../../../src/utils');
      const trustvcModule = await import('@trustvc/trustvc');

      const userAddress = '0x4444444444444444444444444444444444444444';

      (commonModule.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockResolvedValue(
        baseInputs,
      );
      (utilsModule.promptAddress as MockedFunction<any>).mockResolvedValue(userAddress);
      (trustvcModule.removeUserFromWhitelist as MockedFunction<any>).mockResolvedValue('0xtxhash');
      (commonModule.runPaymasterAdminAction as MockedFunction<any>).mockImplementation(
        async ({ execute }: any) => execute(mockWallet),
      );

      const result = await handler();

      expect(result).toBe('0xtxhash');
      expect(utilsModule.promptAddress).toHaveBeenCalledWith(
        'user',
        'address to remove from the whitelist',
      );
      expect(trustvcModule.removeUserFromWhitelist).toHaveBeenCalledWith(
        mockWallet,
        baseInputs.paymasterAddress,
        userAddress,
      );
      expect(commonModule.runPaymasterAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          ...baseInputs,
          actionLabel: `Removing user ${userAddress} from whitelist`,
          execute: expect.any(Function),
        }),
      );
    });

    it('logs an error and returns undefined when prompting fails', async () => {
      const commonModule = await import('../../../../src/commands/gasless/admin/common');
      (commonModule.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockRejectedValue(
        new Error('wallet selection failed'),
      );

      const result = await handler();

      expect(result).toBeUndefined();
      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith('wallet selection failed');
    });

    it('logs a string error when a non-Error is thrown during prompting', async () => {
      const commonModule = await import('../../../../src/commands/gasless/admin/common');
      (commonModule.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockRejectedValue(
        'raw string failure',
      );

      const result = await handler();

      expect(result).toBeUndefined();
      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith('raw string failure');
    });
  });
});
