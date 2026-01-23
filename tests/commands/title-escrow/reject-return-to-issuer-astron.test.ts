import { rejectReturned as rejectReturnedImpl } from '@trustvc/trustvc';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseTitleEscrowCommand as TitleEscrowReturnDocumentCommand } from '../../../src/types';
import { rejectReturned } from '../../../src/commands/title-escrow/reject-return-to-issuer';

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    rejectReturned: vi.fn(),
  };
});

const rejectReturnedDocumentParams: TitleEscrowReturnDocumentCommand = {
  tokenRegistryAddress: '0x1122',
  tokenId: '0x12345',
  remark: '0xabcd',
  encryptionKey: '1234',
  network: 'astron',
  maxPriorityFeePerGasScale: 1,
};

describe('title-escrow', () => {
  describe('rejects returned transferable record', () => {
    beforeEach(() => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(rejectReturnedImpl).mockResolvedValue({
        hash: 'hash',
        wait: () => Promise.resolve({ transactionHash: 'transactionHash' }),
      } as any);
    });

    it('should pass in the correct params and successfully rejects a returned transferable record', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
      await rejectReturned({
        ...rejectReturnedDocumentParams,
        key: privateKey,
      });

      expect(rejectReturnedImpl).toHaveBeenCalledTimes(1);
    });
  });
});
