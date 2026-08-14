import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import { handler } from '../../../../src/commands/gasless/admin/set-user-whitelist';

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
    setUserWhitelist: vi.fn(),
  };
});

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
}));

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

describe('gasless/admin/set-user-whitelist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('handler', () => {
    it('whitelists the user with the prompted address and credits, returning the tx hash', async () => {
      const commonModule = await import('../../../../src/commands/gasless/admin/common');
      const utilsModule = await import('../../../../src/utils');
      const inquirerModule = await import('@inquirer/prompts');
      const trustvcModule = await import('@trustvc/trustvc');

      const userAddress = '0x5555555555555555555555555555555555555555';

      (commonModule.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockResolvedValue(
        baseInputs,
      );
      (utilsModule.promptAddress as MockedFunction<any>).mockResolvedValue(userAddress);
      (inquirerModule.input as MockedFunction<any>).mockResolvedValue('2');
      (trustvcModule.setUserWhitelist as MockedFunction<any>).mockResolvedValue('0xtxhash');
      (commonModule.runPaymasterAdminAction as MockedFunction<any>).mockImplementation(
        async ({ execute }: any) => execute(mockWallet),
      );

      const result = await handler();

      expect(result).toBe('0xtxhash');
      expect(utilsModule.promptAddress).toHaveBeenCalledWith(
        'user',
        'address to whitelist for gasless registry deployment',
      );
      expect(trustvcModule.setUserWhitelist).toHaveBeenCalledWith(
        mockWallet,
        baseInputs.paymasterAddress,
        userAddress,
        BigInt('2'),
      );
      expect(commonModule.runPaymasterAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          ...baseInputs,
          actionLabel: `Whitelisting user ${userAddress} with 2 credit(s)`,
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

  describe('credits validate()', () => {
    it('only accepts integers between 0 and 3', async () => {
      const commonModule = await import('../../../../src/commands/gasless/admin/common');
      const utilsModule = await import('../../../../src/utils');
      const inquirerModule = await import('@inquirer/prompts');

      (commonModule.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockResolvedValue(
        baseInputs,
      );
      (utilsModule.promptAddress as MockedFunction<any>).mockResolvedValue(
        '0x5555555555555555555555555555555555555555',
      );
      (inquirerModule.input as MockedFunction<any>).mockResolvedValue('1');
      (commonModule.runPaymasterAdminAction as MockedFunction<any>).mockResolvedValue('0xtxhash');

      await handler();

      const call = (inquirerModule.input as MockedFunction<any>).mock.calls[0][0];
      const validate = call.validate as (value: string) => string | true;

      expect(validate('0')).toBe(true);
      expect(validate('1')).toBe(true);
      expect(validate('2')).toBe(true);
      expect(validate('3')).toBe(true);
      expect(validate('4')).not.toBe(true);
      expect(validate('-1')).not.toBe(true);
      expect(validate('10')).not.toBe(true);
      expect(validate('abc')).not.toBe(true);
      expect(validate('')).not.toBe(true);
    });
  });
});
