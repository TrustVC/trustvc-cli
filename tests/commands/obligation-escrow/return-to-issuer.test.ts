import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { returnToIssuerHandler } from '../../../src/commands/obligation-escrow/return-to-issuer';
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
    returnToIssuerObligationRegistry: vi.fn(),
  };
});

vi.mock('../../../src/commands/obligation-escrow/runTx', () => ({
  runObligationEscrowTx: vi.fn().mockResolvedValue({ hash: '0xreturn' }),
}));

vi.mock('../../../src/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils')>();
  return {
    ...actual,
    displayTransactionPrice: vi.fn(),
    getEtherscanAddress: vi.fn().mockReturnValue('https://amoy.polygonscan.com'),
    getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  };
});

describe('obligation-escrow/return-to-issuer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returnToIssuerHandler invokes runObligationEscrowTx', async () => {
    const { runObligationEscrowTx } = await import('../../../src/commands/obligation-escrow/runTx');
    await returnToIssuerHandler({
      network: NetworkCmdName.Amoy,
      obligationRegistryAddress: '0xRegistry',
      tokenId: '0x1',
      key: '0xabc',
      maxPriorityFeePerGasScale: 1,
    });
    expect(runObligationEscrowTx as MockedFunction<any>).toHaveBeenCalled();
  });
});
