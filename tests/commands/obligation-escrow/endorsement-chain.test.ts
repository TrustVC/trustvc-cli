import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { endorsementChainHandler } from '../../../src/commands/obligation-escrow/endorsement-chain';
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
    fetchEndorsementChain: vi.fn().mockResolvedValue([
      {
        type: 'INITIAL',
        blockNumber: 1,
        timestamp: 1_700_000_000_000,
        owner: '0xOwner',
        holder: '0xHolder',
        remark: 'minted',
        transactionHash: '0xtx',
      },
      {
        type: 'STATUS_INITIALIZED',
        blockNumber: 1,
        timestamp: 1_700_000_000_000,
        owner: '0xOwner',
        holder: '0xHolder',
        remark: '',
        transactionHash: '0xtx',
      },
    ]),
  };
});

vi.mock('../../../src/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils')>();
  return {
    ...actual,
    getSupportedNetwork: vi.fn().mockReturnValue({
      provider: () => ({ mock: 'infura-provider' }),
      networkId: 11155111,
    }),
    getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  };
});

describe('obligation-escrow/endorsement-chain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches chain via network Infura/RPC using document id as keyId', async () => {
    const trustvc = await import('@trustvc/trustvc');
    await endorsementChainHandler({
      network: NetworkCmdName.Sepolia,
      obligationRegistryAddress: '0xRegistry',
      tokenId: '0x1',
      encryptionKey: 'urn:uuid:test-doc-id',
    });

    expect(trustvc.fetchEndorsementChain as MockedFunction<any>).toHaveBeenCalledWith(
      '0xRegistry',
      '0x1',
      { mock: 'infura-provider' },
      'urn:uuid:test-doc-id',
    );
  });
});
