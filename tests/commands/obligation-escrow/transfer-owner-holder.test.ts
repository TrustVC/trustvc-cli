import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  transferOwnersHandler,
  promptForInputs,
} from '../../../src/commands/obligation-escrow/transfer-owner-holder';
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
    transferOwnersObligationRegistry: vi.fn(),
  };
});

vi.mock('../../../src/commands/obligation-escrow/shared', () => ({
  promptBaseObligationEscrowInputs: vi.fn().mockResolvedValue({
    network: 'amoy',
    obligationRegistryAddress: '0xRegistry',
    tokenId: '0x1',
    encryptionKey: 'doc-id',
    key: '0xabc',
    maxPriorityFeePerGasScale: 1,
  }),
}));

vi.mock('../../../src/commands/obligation-escrow/runTx', () => ({
  runObligationEscrowTx: vi.fn().mockResolvedValue({ hash: '0xtransfer-owner-holder' }),
}));

vi.mock('../../../src/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils')>();
  return {
    ...actual,
    promptAddress: vi
      .fn()
      .mockResolvedValueOnce('0xNewOwner000000000000000000000000000001')
      .mockResolvedValueOnce('0xNewHolder00000000000000000000000000001'),
    displayTransactionPrice: vi.fn(),
    getEtherscanAddress: vi.fn().mockReturnValue('https://amoy.polygonscan.com'),
    getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  };
});

describe('obligation-escrow/transfer-owner-holder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('promptForInputs includes newOwner and newHolder', async () => {
    const result = await promptForInputs();
    expect(result.newOwner).toBe('0xNewOwner000000000000000000000000000001');
    expect(result.newHolder).toBe('0xNewHolder00000000000000000000000000001');
  });

  it('transferOwnersHandler calls runObligationEscrowTx with owner+holder params', async () => {
    const { runObligationEscrowTx } = await import('../../../src/commands/obligation-escrow/runTx');
    await transferOwnersHandler({
      network: NetworkCmdName.Amoy,
      obligationRegistryAddress: '0xRegistry',
      tokenId: '0x1',
      newOwner: '0xNewOwner000000000000000000000000000001',
      newHolder: '0xNewHolder00000000000000000000000000001',
      key: '0xabc',
      maxPriorityFeePerGasScale: 1,
    });
    expect(runObligationEscrowTx as MockedFunction<any>).toHaveBeenCalledWith(
      expect.objectContaining({
        sdkParams: expect.objectContaining({
          newBeneficiaryAddress: '0xNewOwner000000000000000000000000000001',
          newHolderAddress: '0xNewHolder00000000000000000000000000001',
        }),
      }),
    );
  });
});
