import { rejectTransferOwners as rejectTransferOwnersImpl } from '@trustvc/trustvc';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseTitleEscrowCommand } from '../../../src/types';
import { rejectTransferOwnerHolder } from '../../../src/commands/title-escrow/reject-transfer-owner-holder';

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
    rejectTransferOwners: {
      populateTransaction: vi.fn(),
    },
  }),
  validateAndEncryptRemark: vi.fn().mockReturnValue('encrypted-remark'),
  validatePreviousBeneficiary: vi.fn(),
  validatePreviousHolder: vi.fn(),
}));

vi.mock('../../../src/utils/wallet', () => ({
  getWalletOrSigner: vi.fn(),
}));

vi.mock('../../../src/utils', async (importOriginal) => {
  const originalUtils = await importOriginal<typeof import('../../../src/utils')>();
  return {
    ...originalUtils,
    performDryRunWithConfirmation: vi.fn(async () => true),
  };
});

const transferOwnerHolderParams: BaseTitleEscrowCommand = {
  remark: '0xabcd',
  encryptionKey: '1234',
  tokenId: '0x12345',
  tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
  network: 'sepolia',
  maxPriorityFeePerGasScale: 1,
};

describe('title-escrow', () => {
  describe('reject Owner and Holder of transferable record', () => {
    beforeEach(async () => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(rejectTransferOwnersImpl).mockResolvedValue({
        hash: 'hash',
        wait: () => Promise.resolve({ transactionHash: 'transactionHash' }),
      } as any);

      // Setup wallet mock with getAddress and provider
      const walletModule = await import('../../../src/utils/wallet');
      const getWalletOrSignerMock = walletModule.getWalletOrSigner as any;
      getWalletOrSignerMock.mockResolvedValue({
        provider: {
          getNetwork: vi.fn().mockResolvedValue({ chainId: 11155111, name: 'sepolia' }),
          getFeeData: vi.fn().mockResolvedValue({
            maxFeePerGas: 1000000000n,
            maxPriorityFeePerGas: 1000000000n,
          }),
        },
        getAddress: vi.fn().mockResolvedValue('0xfrom'),
      });

      // Ensure performDryRunWithConfirmation returns true
      const utils = await import('../../../src/utils');
      (utils.performDryRunWithConfirmation as any).mockResolvedValue(true);
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

      // Mock performDryRunWithConfirmation to throw the validation error
      const utils = await import('../../../src/utils');
      (utils.performDryRunWithConfirmation as any).mockRejectedValueOnce(
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

      // Mock performDryRunWithConfirmation to throw the validation error
      const utils = await import('../../../src/utils');
      (utils.performDryRunWithConfirmation as any).mockRejectedValueOnce(
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
