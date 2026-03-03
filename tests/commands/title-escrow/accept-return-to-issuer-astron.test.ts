import { acceptReturned as acceptReturnedImpl } from '@trustvc/trustvc';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseTitleEscrowCommand as TitleEscrowReturnDocumentCommand } from '../../../src/types';
import { acceptReturned } from '../../../src/commands/title-escrow/accept-return-to-issuer';

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    acceptReturned: vi.fn(),
  };
});

const acceptReturnedDocumentParams: TitleEscrowReturnDocumentCommand = {
  tokenRegistryAddress: '0x1122',
  tokenId: '0x12345',
  remark: '0xabcd',
  encryptionKey: '1234',
  network: 'astron',
  maxPriorityFeePerGasScale: 1,
};

describe('title-escrow', () => {
  describe('accepts returned transferable record', () => {
    beforeEach(() => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(acceptReturnedImpl).mockResolvedValue({
        hash: 'hash',
        wait: () => Promise.resolve({ transactionHash: 'transactionHash' }),
      } as any);
    });
    it('should pass in the correct params and successfully accepts a returned transferable record', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
      await acceptReturned({
        ...acceptReturnedDocumentParams,
        key: privateKey,
      });

      expect(acceptReturnedImpl).toHaveBeenCalledTimes(1);
    });
  });
});
