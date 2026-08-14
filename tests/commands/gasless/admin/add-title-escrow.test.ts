import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import { handler } from '../../../../src/commands/gasless/admin/add-title-escrow';

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
    addTitleEscrow: vi.fn(),
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

describe('gasless/admin/add-title-escrow', () => {
  const base = {
    network: 'sepolia',
    paymasterAddress: '0xpaymaster000000000000000000000000000000',
    encryptedWalletPath: './wallet.json',
  };
  const mockWallet = { getAddress: vi.fn().mockResolvedValue('0xfrom') };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  it('should authorize the prompted title escrow against the prompted paymaster', async () => {
    const common = await import('../../../../src/commands/gasless/admin/common');
    (common.promptForPaymasterAdminWalletInputs as MockedFunction<any>).mockResolvedValue(base);
    (common.runPaymasterAdminAction as MockedFunction<any>).mockImplementation(
      async ({ execute }: any) => execute(mockWallet),
    );

    const utils = await import('../../../../src/utils');
    const titleEscrowAddress = '0x1234567890123456789012345678901234567890';
    (utils.promptAddress as MockedFunction<any>).mockResolvedValue(titleEscrowAddress);

    const trustvc = await import('@trustvc/trustvc');
    (trustvc.addTitleEscrow as MockedFunction<any>).mockResolvedValue('0xtxhash');

    const result = await handler();

    expect(utils.promptAddress).toHaveBeenCalledWith(
      'title escrow',
      'title escrow address to authorize',
    );
    expect(trustvc.addTitleEscrow).toHaveBeenCalledWith(
      mockWallet,
      base.paymasterAddress,
      titleEscrowAddress,
    );
    expect(common.runPaymasterAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        ...base,
        actionLabel: `Authorizing title escrow ${titleEscrowAddress}`,
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
});
