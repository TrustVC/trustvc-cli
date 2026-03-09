import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCancelTransaction } from '../../../src/commands/transaction/cancel';

vi.mock('@trustvc/trustvc', () => ({
  cancelTransaction: vi.fn().mockResolvedValue('0xreplacementHash'),
}));

vi.mock('../../../src/utils', () => ({
  getWalletOrSigner: vi.fn().mockResolvedValue({
    getAddress: vi.fn().mockResolvedValue('0x1234'),
    provider: {},
  }),
  getEtherscanAddress: vi.fn().mockReturnValue('https://sepolia.etherscan.io'),
  getErrorMessage: vi.fn((e: Error) => e.message),
  promptNetworkSelection: vi.fn().mockResolvedValue('sepolia'),
  promptWalletSelection: vi.fn().mockResolvedValue({ key: '0xkey' }),
}));

vi.mock('signale', () => ({
  default: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
}));

describe('transaction cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runCancelTransaction', () => {
    it('calls cancelTransaction and returns replacement hash', async () => {
      const { cancelTransaction } = await import('@trustvc/trustvc');
      const answers = {
        network: 'sepolia',
        nonce: '0',
        gasPrice: '25000000000',
        key: '0xabc',
      };

      const hash = await runCancelTransaction(answers);

      expect(cancelTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ nonce: '0', gasPrice: '25000000000' }),
      );
      expect(hash).toBe('0xreplacementHash');
    });

    it('passes transactionHash when provided', async () => {
      const { cancelTransaction } = await import('@trustvc/trustvc');
      const answers = {
        network: 'sepolia',
        transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        key: '0xkey',
      };

      await runCancelTransaction(answers);

      expect(cancelTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ transactionHash: answers.transactionHash }),
      );
    });
  });
});
