import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { statusHandler } from '../../../src/commands/obligation-escrow/status';
import { NetworkCmdName } from '../../../src/utils';

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
    await: vi.fn(),
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
    getObligationRegistryStatus: vi.fn().mockResolvedValue(0),
    isObligationRegistryRegistered: vi.fn().mockResolvedValue(true),
    getObligationEscrowTerminationReason: vi.fn().mockResolvedValue(0),
  };
});

vi.mock('../../../src/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils')>();
  return {
    ...actual,
    getSupportedNetwork: vi.fn().mockReturnValue({
      provider: () => ({ mock: 'provider' }),
      networkId: 80002,
    }),
    getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  };
});

describe('obligation-escrow/status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads status via network provider without a wallet', async () => {
    const trustvc = await import('@trustvc/trustvc');
    await statusHandler({
      network: NetworkCmdName.Amoy,
      obligationRegistryAddress: '0xRegistry',
      tokenId: '0x1',
    });
    expect(trustvc.getObligationRegistryStatus as MockedFunction<any>).toHaveBeenCalledWith(
      { obligationRegistryAddress: '0xRegistry', tokenId: '0x1' },
      { provider: { mock: 'provider' } },
      { tokenId: '0x1' },
    );
    expect(trustvc.isObligationRegistryRegistered).toHaveBeenCalled();
    expect(trustvc.getObligationEscrowTerminationReason).toHaveBeenCalled();
  });
});
