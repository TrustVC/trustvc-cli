import { transferHolder as transferHolderImpl } from '@trustvc/trustvc';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TitleEscrowTransferHolderCommand } from '../../../src/types';
import { transferHolder } from '../../../src/implementations/title-escrow/transferHolder';

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    transferHolder: vi.fn(),
  };
});

vi.mock('../../../src/implementations/title-escrow/helpers', () => ({
  connectToTitleEscrow: vi.fn().mockResolvedValue({
    holder: vi.fn().mockResolvedValue('0x3333333333333333333333333333333333333333'),
  }),
  validateAndEncryptRemark: vi.fn().mockReturnValue('encrypted-remark'),
}));

const transferHolderParams: TitleEscrowTransferHolderCommand = {
  newHolder: '0x1111111111111111111111111111111111111111',
  remark: '0xabcd',
  encryptionKey: '1234',
  tokenId: '0x12345',
  tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
  network: 'sepolia',
  maxPriorityFeePerGasScale: 1,
  dryRun: false,
};

describe('title-escrow', () => {
  describe('change holder of transferable record', () => {
    beforeEach(() => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(transferHolderImpl).mockResolvedValue({
        hash: 'hash',
        wait: () => Promise.resolve({ transactionHash: 'transactionHash' }),
      } as any);
    });

    it('should pass in the correct params and call the following procedures to invoke a change in holder of a transferable record', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
      await transferHolder({
        ...transferHolderParams,
        key: privateKey,
      });

      expect(transferHolderImpl).toHaveBeenCalledTimes(1);
    });
  });
});
