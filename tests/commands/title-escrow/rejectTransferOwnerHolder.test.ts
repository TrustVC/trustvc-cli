import { rejectTransferOwners as rejectTransferOwnersImpl } from '@trustvc/trustvc';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseTitleEscrowCommand } from '../../../src/types';
import { rejectTransferOwnerHolder } from '../../../src/commands/title-escrow/reject-transfer-owner-holder';
import {
  validatePreviousBeneficiary,
  validatePreviousHolder,
} from '../../../src/commands/helpers';

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    rejectTransferOwners: vi.fn(),
  };
});

vi.mock('../../../src/commands/helpers', () => ({
  connectToTitleEscrow: vi.fn().mockResolvedValue({
    prevBeneficiary: vi.fn().mockResolvedValue('0x3333333333333333333333333333333333333333'),
    prevHolder: vi.fn().mockResolvedValue('0x4444444444444444444444444444444444444444'),
    rejectTransferOwners: vi.fn().mockResolvedValue({
      hash: 'hash',
      wait: () => Promise.resolve({ transactionHash: 'transactionHash' }),
    }),
    estimateGas: {
      rejectTransferOwners: vi.fn().mockResolvedValue(100000n),
    },
  }),
  validateAndEncryptRemark: vi.fn().mockReturnValue('encrypted-remark'),
  validatePreviousBeneficiary: vi.fn(),
  validatePreviousHolder: vi.fn(),
}));

const transferOwnerHolderParams: BaseTitleEscrowCommand = {
  remark: '0xabcd',
  encryptionKey: '1234',
  tokenId: '0x12345',
  tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
  network: 'sepolia',
  maxPriorityFeePerGasScale: 1,
  dryRun: false,
};

describe('title-escrow', () => {
  describe('reject Owner and Holder of transferable record', () => {
    beforeEach(() => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(rejectTransferOwnersImpl).mockResolvedValue({
        hash: 'hash',
        wait: () => Promise.resolve({ transactionHash: 'transactionHash' }),
      } as any);
    });

    it('should pass in the correct params and call the following procedures to invoke a reject OwnerHolder of a transferable record', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
      await rejectTransferOwnerHolder({
        ...transferOwnerHolderParams,
        key: privateKey,
      });

      expect(rejectTransferOwnersImpl).toHaveBeenCalledTimes(1);
    });
    it('should throw error if previous owner is not available', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
      vi.mocked(validatePreviousBeneficiary).mockRejectedValueOnce(
        new Error('invalid rejection as previous beneficiary is not set'),
      );

      await expect(
        rejectTransferOwnerHolder({
          ...transferOwnerHolderParams,
          remark: '0xabcd',
          key: privateKey,
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: invalid rejection as previous beneficiary is not set]`,
      );
    });
    it('should throw error if previous holder is not available', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
      vi.mocked(validatePreviousHolder).mockRejectedValueOnce(
        new Error('invalid rejection as previous holder is not set'),
      );

      await expect(
        rejectTransferOwnerHolder({
          ...transferOwnerHolderParams,
          remark: '0xabcd',
          key: privateKey,
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: invalid rejection as previous holder is not set]`,
      );
    });
  });
});
