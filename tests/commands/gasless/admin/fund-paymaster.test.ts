import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import { handler } from '../../../../src/commands/gasless/admin/fund-paymaster';

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

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
}));

const { contractDepositMock, ContractMock } = vi.hoisted(() => {
  const contractDepositMock = vi.fn();
  const ContractMock = vi.fn().mockImplementation(() => ({
    deposit: contractDepositMock,
  }));
  return { contractDepositMock, ContractMock };
});

vi.mock('ethers', async () => {
  const actual = await vi.importActual<typeof import('ethers')>('ethers');
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      Contract: ContractMock,
      parseEther: vi.fn((value: string) => `wei(${value})`),
    },
  };
});

vi.mock('../../../../src/commands/gasless/admin/common', () => ({
  promptForPaymasterAdminWalletInputs: vi.fn(),
  runPaymasterAdminAction: vi.fn(),
}));

describe('gasless/admin/fund-paymaster', () => {
  const base = {
    network: 'sepolia',
    paymasterAddress: '0xpaymaster000000000000000000000000000000',
    encryptedWalletPath: './wallet.json',
  };
  const mockWallet = { getAddress: vi.fn().mockResolvedValue('0xfrom') };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    ContractMock.mockImplementation(() => ({
      deposit: contractDepositMock,
    }));

    const { ethers } = await import('ethers');
    (ethers.parseEther as MockedFunction<any>).mockImplementation(
      (value: string) => `wei(${value})`,
    );
  });

  it('should deposit the entered ETH amount into the paymaster contract', async () => {
    const common = await import('../../../../src/commands/gasless/admin/common');
    (common.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockResolvedValue(base);
    (common.runPaymasterAdminAction as MockedFunction<any>).mockImplementation(
      async ({ execute }: any) => execute(mockWallet),
    );

    const { input } = await import('@inquirer/prompts');
    (input as MockedFunction<any>).mockResolvedValue('1.5');

    const receipt = { hash: '0xtxhash' };
    contractDepositMock.mockResolvedValue({ wait: vi.fn().mockResolvedValue(receipt) });

    const result = await handler();

    expect(ContractMock).toHaveBeenCalledWith(base.paymasterAddress, expect.anything(), mockWallet);
    expect(contractDepositMock).toHaveBeenCalledWith({ value: 'wei(1.5)' });
    expect(common.runPaymasterAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        ...base,
        actionLabel: 'Depositing 1.5 ETH',
        execute: expect.any(Function),
      }),
    );
    expect(result).toBe('0xtxhash');
  });

  it('should log an error and return undefined when prompting fails', async () => {
    const common = await import('../../../../src/commands/gasless/admin/common');
    (common.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockRejectedValue(
      new Error('network not supported'),
    );

    const result = await handler();

    expect(result).toBeUndefined();
    const signale = await import('signale');
    expect(signale.error).toHaveBeenCalledWith('network not supported');
  });

  it('should log a non-Error rejection message', async () => {
    const common = await import('../../../../src/commands/gasless/admin/common');
    (common.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockRejectedValue('boom');

    const result = await handler();

    expect(result).toBeUndefined();
    const signale = await import('signale');
    expect(signale.error).toHaveBeenCalledWith('boom');
  });

  describe('amount validation', () => {
    let validate: (value: string) => string | boolean;

    beforeEach(async () => {
      const common = await import('../../../../src/commands/gasless/admin/common');
      (common.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockResolvedValue(base);
      (common.runPaymasterAdminAction as MockedFunction<any>).mockResolvedValue('0xtxhash');

      const { input } = await import('@inquirer/prompts');
      (input as MockedFunction<any>).mockImplementation(async (options: any) => {
        validate = options.validate;
        return '1';
      });

      await handler();
    });

    it('should reject a non-numeric value', () => {
      expect(validate('abc')).toBe('Amount must be a positive number (ETH)');
    });

    it('should reject zero', () => {
      expect(validate('0')).toBe('Amount must be a positive number (ETH)');
    });

    it('should reject a negative value', () => {
      expect(validate('-1')).toBe('Amount must be a positive number (ETH)');
    });

    it('should accept a positive integer', () => {
      expect(validate('1')).toBe(true);
    });

    it('should accept a positive decimal', () => {
      expect(validate('0.5')).toBe(true);
    });
  });
});
