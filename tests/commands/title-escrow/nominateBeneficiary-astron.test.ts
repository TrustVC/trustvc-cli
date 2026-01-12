import { v5Contracts, nominate as nominateImpl } from '@trustvc/trustvc';
import { Wallet } from 'ethers';
import { beforeAll, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import { TitleEscrowNominateBeneficiaryCommand } from '../../../src/types';
import { nominateBeneficiary } from '../../../src/implementations/title-escrow/nominateBeneficiary';

const { TitleEscrow__factory, TradeTrustToken__factory } = v5Contracts;
vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    nominate: vi.fn(),
  };
});

vi.mock('../../../src/implementations/title-escrow/helpers', () => ({
  connectToTitleEscrow: vi.fn().mockResolvedValue({
    beneficiary: vi.fn().mockResolvedValue('0x3333333333333333333333333333333333333333'),
  }),
  validateNominateBeneficiary: vi.fn().mockImplementation(async ({ beneficiaryNominee }) => {
    if (beneficiaryNominee === '0x1111111111111111111111111111111111111111') {
      throw new Error('new beneficiary address is the same as the current beneficiary address');
    }
  }),
  validateAndEncryptRemark: vi.fn().mockReturnValue('encrypted-remark'),
}));

const nominateBeneficiaryParams: TitleEscrowNominateBeneficiaryCommand = {
  newBeneficiary: '0x2222222222222222222222222222222222222222',
  tokenId: '0x12345',
  tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
  network: 'astron',
  maxPriorityFeePerGasScale: 1,
  dryRun: false,
};

describe('title-escrow', () => {
  describe('nominate change of owner of transferable record', () => {
    const mockedTradeTrustTokenFactory: Mock<typeof TradeTrustToken__factory> =
      TradeTrustToken__factory as any;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore mock static method
    const mockedConnectERC721: Mock = mockedTradeTrustTokenFactory.connect;
    const mockedTokenFactory: Mock<typeof TitleEscrow__factory> = TitleEscrow__factory as any;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore mock static method
    const mockedConnectTokenFactory: Mock = mockedTokenFactory.connect;
    const mockedOwnerOf = vi.fn();
    const mockNominateBeneficiary = vi.fn();
    const mockedTitleEscrowAddress = '0x2133';
    const mockedBeneficiary = '0xdssfs';
    const mockedHolder = '0xdsfls';
    const mockGetBeneficiary = vi.fn();
    const mockGetHolder = vi.fn();
    const mockCallStaticNominateBeneficiary = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(nominateImpl).mockResolvedValue({
        hash: 'hash',
        wait: () => Promise.resolve({ transactionHash: 'transactionHash' }),
      } as any);
    });

    it('should pass in the correct params and call the following procedures to invoke an nomination of change of owner of a transferable record', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
      await nominateBeneficiary({
        ...nominateBeneficiaryParams,
        key: privateKey,
      });

      expect(nominateImpl).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if new owner addresses is the same as current owner', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
      await expect(
        nominateBeneficiary({
          ...nominateBeneficiaryParams,
          newBeneficiary: '0x1111111111111111111111111111111111111111',
          key: privateKey,
        }),
      ).rejects.toThrow('new beneficiary address is the same as the current beneficiary address');
    });
  });
});
