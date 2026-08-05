import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  rejectReturnedHandler,
  promptForInputs,
} from '../../../src/commands/obligation-escrow/reject-return-to-issuer';
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
    rejectReturnedObligationRegistry: vi.fn(),
  };
});

vi.mock('../../../src/commands/obligation-escrow/shared', () => ({
  promptBaseObligationEscrowInputs: vi.fn().mockResolvedValue({
    network: 'amoy',
    obligationRegistryAddress: '0xRegistry',
    tokenId: '0x1',
    remark: 'ok',
    encryptionKey: 'doc-id',
    key: '0xabc',
    maxPriorityFeePerGasScale: 1,
  }),
}));

const { restorePopulateTransaction, escrowRejectReturned } = vi.hoisted(() => ({
  restorePopulateTransaction: vi.fn().mockResolvedValue({ to: '0xRegistry', data: '0xrestore' }),
  escrowRejectReturned: vi.fn(),
}));

vi.mock('../../../src/commands/helpers', () => ({
  connectToObligationEscrow: vi.fn().mockResolvedValue({
    // The escrow contract intentionally has no rejectReturned method: restoring
    // a returned title happens on the registry, not the escrow.
    rejectReturned: escrowRejectReturned,
  }),
  connectToObligationRegistry: vi.fn().mockResolvedValue({
    restore: { populateTransaction: restorePopulateTransaction },
  }),
  validateAndEncryptRemark: vi.fn().mockReturnValue('0xencrypted'),
}));

vi.mock('../../../src/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils')>();
  return {
    ...actual,
    getWalletOrSigner: vi.fn().mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xFrom'),
      provider: {},
    }),
    getSupportedNetwork: vi.fn().mockReturnValue({ networkId: 80002 }),
    canEstimateGasPrice: vi.fn().mockReturnValue(false),
    performDryRunWithConfirmation: vi.fn(async ({ getTransactionCallback }) => {
      await getTransactionCallback();
      return true;
    }),
    displayTransactionPrice: vi.fn(),
    getEtherscanAddress: vi.fn().mockReturnValue('https://amoy.polygonscan.com'),
    getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  };
});

describe('obligation-escrow/reject-return-to-issuer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promptForInputs uses shared obligation prompts', async () => {
    const result = await promptForInputs();
    expect(result.obligationRegistryAddress).toBe('0xRegistry');
  });

  it('dry-run populates restore() on the registry contract, not the escrow', async () => {
    const trustvc = await import('@trustvc/trustvc');
    (trustvc.rejectReturnedObligationRegistry as MockedFunction<any>).mockResolvedValue({
      hash: '0xreject-return',
      wait: vi.fn().mockResolvedValue({ hash: '0xreject-return' }),
    });

    await rejectReturnedHandler({
      network: NetworkCmdName.Amoy,
      obligationRegistryAddress: '0xRegistry',
      tokenId: '0x1',
      remark: 'ok',
      encryptionKey: 'doc-id',
      key: '0xabc',
      maxPriorityFeePerGasScale: 1,
    });

    expect(restorePopulateTransaction).toHaveBeenCalledWith('0x1', '0xencrypted');
    expect(escrowRejectReturned).not.toHaveBeenCalled();
    expect(trustvc.rejectReturnedObligationRegistry).toHaveBeenCalled();
  });
});
