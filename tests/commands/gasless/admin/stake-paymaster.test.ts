import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import { eip7702Abis } from '@trustvc/trustvc';
import { ethers } from 'ethers';
import { handler } from '../../../../src/commands/gasless/admin/stake-paymaster';

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

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      Contract: vi.fn(),
    },
  };
});

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
}));

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

describe('gasless/admin/stake-paymaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('handler', () => {
    it('stakes the parsed ETH amount with the prompted unstake delay and returns the receipt hash', async () => {
      const commonModule = await import('../../../../src/commands/gasless/admin/common');
      const inquirerModule = await import('@inquirer/prompts');

      (commonModule.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockResolvedValue(
        baseInputs,
      );
      (inquirerModule.input as MockedFunction<any>)
        .mockResolvedValueOnce('1.5')
        .mockResolvedValueOnce('3600');

      const addStakeMock = vi.fn().mockResolvedValue({
        wait: vi.fn().mockResolvedValue({ hash: '0xreceipthash' }),
      });
      (ethers.Contract as unknown as MockedFunction<any>).mockImplementation(
        () =>
          ({
            addStake: addStakeMock,
          }) as any,
      );

      (commonModule.runPaymasterAdminAction as MockedFunction<any>).mockImplementation(
        async ({ execute }: any) => execute(mockWallet),
      );

      const result = await handler();

      expect(result).toBe('0xreceipthash');
      expect(ethers.Contract).toHaveBeenCalledWith(
        baseInputs.paymasterAddress,
        eip7702Abis.platformPaymasterAbi,
        mockWallet,
      );
      expect(addStakeMock).toHaveBeenCalledWith(3600, { value: ethers.parseEther('1.5') });
      expect(commonModule.runPaymasterAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({
          ...baseInputs,
          actionLabel: 'Staking 1.5 ETH with a 3600s unstake delay',
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

  describe('amount and unstake delay validate()', () => {
    it('captures both validate callbacks and rejects invalid input', async () => {
      const commonModule = await import('../../../../src/commands/gasless/admin/common');
      const inquirerModule = await import('@inquirer/prompts');

      (commonModule.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockResolvedValue(
        baseInputs,
      );
      (inquirerModule.input as MockedFunction<any>)
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('86400');
      (ethers.Contract as unknown as MockedFunction<any>).mockImplementation(
        () =>
          ({
            addStake: vi
              .fn()
              .mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: '0x1' }) }),
          }) as any,
      );
      (commonModule.runPaymasterAdminAction as MockedFunction<any>).mockResolvedValue('0xtxhash');

      await handler();

      const amountCall = (inquirerModule.input as MockedFunction<any>).mock.calls[0][0];
      const delayCall = (inquirerModule.input as MockedFunction<any>).mock.calls[1][0];

      expect(delayCall.default).toBe('86400');

      const validateAmount = amountCall.validate as (value: string) => string | true;
      expect(validateAmount('1')).toBe(true);
      expect(validateAmount('0.5')).toBe(true);
      expect(validateAmount('0')).not.toBe(true);
      expect(validateAmount('-1')).not.toBe(true);
      expect(validateAmount('abc')).not.toBe(true);
      expect(validateAmount('')).not.toBe(true);

      const validateDelay = delayCall.validate as (value: string) => string | true;
      expect(validateDelay('86400')).toBe(true);
      expect(validateDelay('1')).toBe(true);
      expect(validateDelay('0')).not.toBe(true);
      expect(validateDelay('-100')).not.toBe(true);
      expect(validateDelay('1.5')).not.toBe(true);
      expect(validateDelay('abc')).not.toBe(true);
    });
  });
});
