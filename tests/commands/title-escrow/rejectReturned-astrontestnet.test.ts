import { v5Contracts, rejectReturned as rejectReturnedImpl } from '@trustvc/trustvc';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import { BaseTitleEscrowCommand as TitleEscrowReturnDocumentCommand } from '../../../src/types';
import { rejectReturned } from '../../../src/commands/title-escrow/reject-returned';

const { TitleEscrow__factory, TradeTrustToken__factory } = v5Contracts;
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
  network: 'astrontestnet',
  maxPriorityFeePerGasScale: 1,
  dryRun: false,
};

describe('title-escrow', () => {
  describe('rejects returned transferable record', () => {
    const mockedTradeTrustTokenFactory: Mock<typeof TradeTrustToken__factory> =
      TradeTrustToken__factory as any;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore mock static method
    const _mockedConnectERC721: Mock = mockedTradeTrustTokenFactory.connect;
    const mockedTitleEscrowFactory: Mock<typeof TitleEscrow__factory> = TitleEscrow__factory as any;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore mock static method
    const _mockedConnectTitleEscrowFactory: Mock = mockedTitleEscrowFactory.connect;

    const _mockedBeneficiary = vi.fn();
    const _mockedHolder = vi.fn();
    const _mockRestoreTitle = vi.fn();
    const _mockTransferEvent = vi.fn();
    const _mockQueryFilter = vi.fn();
    const _mockCallStaticRestoreTitle = vi.fn().mockResolvedValue(undefined);

    const _mockedLastTitleEscrowAddress = '0xMockedLastTitleEscrowAddress';
    const _mockedLastBeneficiary = '0xMockedLastBeneficiaryAddress';
    const _mockedLastHolder = '0xMockedLastHolderAddress';

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
