import { returnToIssuer as returnToIssuerImpl } from '@trustvc/trustvc';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseTitleEscrowCommand as TitleEscrowReturnDocumentCommand } from '../../../src/types';
import { returnDocument } from '../../../src/commands/title-escrow/return-document';

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    returnToIssuer: vi.fn(),
  };
});

vi.mock('../../../src/commands/helpers', () => ({
  connectToTitleEscrow: vi.fn().mockResolvedValue({
    returnToIssuer: vi.fn().mockResolvedValue({
      hash: 'hash',
      wait: () => Promise.resolve({ transactionHash: 'transactionHash' }),
    }),
  }),
  validateAndEncryptRemark: vi.fn().mockReturnValue('encrypted-remark'),
}));

const returnDocumentParams: TitleEscrowReturnDocumentCommand = {
  tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
  tokenId: '0x12345',
  remark: '0xabcd',
  encryptionKey: '1234',
  network: 'astron',
  maxPriorityFeePerGasScale: 1,
  dryRun: false,
};

describe('title-escrow', () => {
  describe('return transferable record', () => {
    beforeEach(() => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(returnToIssuerImpl).mockResolvedValue({
        hash: 'hash',
        wait: () => Promise.resolve({ transactionHash: 'transactionHash' }),
      } as any);
    });
    it('should pass in the correct params and successfully return a transferable record', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
      await returnDocument({
        ...returnDocumentParams,
        key: privateKey,
      });

      expect(returnToIssuerImpl).toHaveBeenCalledTimes(1);
    });
  });
});
