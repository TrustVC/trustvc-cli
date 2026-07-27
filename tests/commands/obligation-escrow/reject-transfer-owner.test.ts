import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  rejectTransferOwnerHandler,
  promptForInputs,
} from '../../../src/commands/obligation-escrow/reject-transfer-owner';
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
    rejectTransferBeneficiaryObligationRegistry: vi.fn(),
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

vi.mock('../../../src/commands/obligation-escrow/runTx', () => ({
  runObligationEscrowTx: vi.fn().mockResolvedValue({ hash: '0xreject-transfer-owner' }),
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

describe('obligation-escrow/reject-transfer-owner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('promptForInputs uses shared obligation prompts', async () => {
    const result = await promptForInputs();
    expect(result.obligationRegistryAddress).toBe('0xRegistry');
  });

  it('rejectTransferOwnerHandler runs SDK via runObligationEscrowTx', async () => {
    const { runObligationEscrowTx } = await import('../../../src/commands/obligation-escrow/runTx');
    await rejectTransferOwnerHandler({
      network: NetworkCmdName.Amoy,
      obligationRegistryAddress: '0xRegistry',
      tokenId: '0x1',
      key: '0xabc',
      maxPriorityFeePerGasScale: 1,
    });
    expect(runObligationEscrowTx as MockedFunction<any>).toHaveBeenCalledWith(
      expect.objectContaining({
        sdkParams: expect.objectContaining({ remarks: undefined }),
      }),
    );
  });
});
