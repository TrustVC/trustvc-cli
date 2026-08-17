import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { statusHandler } from '../../../src/commands/obligation-escrow/status';
import { NetworkCmdName } from '../../../src/utils';
import { Contract, ZeroAddress } from 'ethers';
import { info, success } from 'signale';

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
    getTitleEscrowAddress: vi.fn().mockResolvedValue('0xEscrow'),
  };
});

vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ethers')>();
  return {
    ...actual,
    Contract: vi.fn().mockImplementation(() => ({
      beneficiary: vi.fn().mockResolvedValue('0xBeneficiary'),
      holder: vi.fn().mockResolvedValue('0xHolder'),
      nominee: vi.fn().mockResolvedValue(actual.ZeroAddress),
      lastBeneficiary: vi.fn().mockResolvedValue(actual.ZeroAddress),
      lastHolder: vi.fn().mockResolvedValue(actual.ZeroAddress),
    })),
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
  beforeEach(async () => {
    vi.clearAllMocks();
    const trustvc = await import('@trustvc/trustvc');
    vi.mocked(trustvc.getObligationRegistryStatus).mockResolvedValue(0);
    vi.mocked(trustvc.isObligationRegistryRegistered).mockResolvedValue(true);
    vi.mocked(trustvc.getObligationEscrowTerminationReason).mockResolvedValue(0);
    vi.mocked(trustvc.getTitleEscrowAddress).mockResolvedValue('0xEscrow');
    vi.mocked(Contract).mockImplementation(
      () =>
        ({
          beneficiary: vi.fn().mockResolvedValue('0xBeneficiary'),
          holder: vi.fn().mockResolvedValue('0xHolder'),
          nominee: vi.fn().mockResolvedValue(ZeroAddress),
          lastBeneficiary: vi.fn().mockResolvedValue(ZeroAddress),
          lastHolder: vi.fn().mockResolvedValue(ZeroAddress),
        }) as any,
    );
  });

  it('reads status via network provider without a wallet', async () => {
    const trustvc = await import('@trustvc/trustvc');
    await statusHandler({
      network: NetworkCmdName.Amoy,
      obligationRegistryAddress: '0xRegistry',
      tokenId: '0x1',
    });
    expect(trustvc.getObligationRegistryStatus as MockedFunction<any>).toHaveBeenCalledWith(
      { obligationRegistryAddress: '0xRegistry', tokenId: '0x1' },
      expect.objectContaining({ provider: { mock: 'provider' } }),
      { tokenId: '0x1' },
    );
    expect(trustvc.isObligationRegistryRegistered).toHaveBeenCalled();
    expect(trustvc.getObligationEscrowTerminationReason).toHaveBeenCalled();
    expect(trustvc.getTitleEscrowAddress).toHaveBeenCalledWith(
      '0xRegistry',
      '0x1',
      { mock: 'provider' },
      { titleEscrowVersion: 'v5' },
    );
    expect(info).toHaveBeenCalledWith('  Owner (beneficiary): 0xBeneficiary');
    expect(info).toHaveBeenCalledWith('  Holder: 0xHolder');
  });

  it('prints lastBeneficiary and lastHolder when current parties are zero after shred', async () => {
    vi.mocked(Contract).mockImplementation(
      () =>
        ({
          beneficiary: vi.fn().mockResolvedValue(ZeroAddress),
          holder: vi.fn().mockResolvedValue(ZeroAddress),
          nominee: vi.fn().mockResolvedValue(ZeroAddress),
          lastBeneficiary: vi.fn().mockResolvedValue('0xLastBeneficiary'),
          lastHolder: vi.fn().mockResolvedValue('0xLastHolder'),
        }) as any,
    );

    await statusHandler({
      network: NetworkCmdName.Amoy,
      obligationRegistryAddress: '0xRegistry',
      tokenId: '0x1',
    });

    expect(info).toHaveBeenCalledWith('  Owner (beneficiary): 0xLastBeneficiary');
    expect(info).toHaveBeenCalledWith('  Holder: 0xLastHolder');
  });

  it('still prints registry-level status when escrow address resolution fails', async () => {
    const trustvc = await import('@trustvc/trustvc');
    vi.mocked(trustvc.getTitleEscrowAddress).mockRejectedValue(new Error('no escrow deployed'));

    await statusHandler({
      network: NetworkCmdName.Amoy,
      obligationRegistryAddress: '0xRegistry',
      tokenId: '0x1',
    });

    expect(success).toHaveBeenCalledWith('Obligation 0x1 on 0xRegistry');
    expect(info).toHaveBeenCalledWith('  Status: Issued (0)');
    expect(info).toHaveBeenCalledWith('  Registered: true');
    expect(info).toHaveBeenCalledWith('  Termination reason: None (0)');
    expect(info).not.toHaveBeenCalledWith(expect.stringContaining('Escrow:'));
    expect(Contract).not.toHaveBeenCalled();
  });
});
