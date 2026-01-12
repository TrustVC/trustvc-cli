import { v5Contracts, transferBeneficiary as transferBeneficiaryImpl } from "@trustvc/trustvc";
import { beforeEach, describe, expect, it, vi, Mock } from "vitest";
import { TitleEscrowNominateBeneficiaryCommand } from "../../../src/types";
import { endorseNominatedBeneficiary } from "../../../src/implementations/title-escrow/endorseNominatedBeneficiary";

const { TitleEscrow__factory, TradeTrustToken__factory } = v5Contracts;
vi.mock("@trustvc/trustvc", async () => {
  const actual = await vi.importActual<typeof import("@trustvc/trustvc")>("@trustvc/trustvc");
  return {
    ...actual,
    transferBeneficiary: vi.fn(),
  };
});

vi.mock("../../../src/implementations/title-escrow/helpers", () => ({
  connectToTitleEscrow: vi.fn().mockResolvedValue({
    beneficiary: vi.fn().mockResolvedValue("0x3333333333333333333333333333333333333333"),
  }),
  validateNominateBeneficiary: vi.fn().mockImplementation(async ({ beneficiaryNominee }) => {
    if (beneficiaryNominee === "0x2222222222222222222222222222222222222222") {
      throw new Error("new beneficiary address is the same as the current beneficiary address");
    }
  }),
  validateAndEncryptRemark: vi.fn().mockReturnValue("encrypted-remark"),
}));

const endorseNominatedBeneficiaryParams: TitleEscrowNominateBeneficiaryCommand = {
  tokenId: "0x12345",
  tokenRegistryAddress: "0x1234567890123456789012345678901234567890",
  newBeneficiary: "0x1111111111111111111111111111111111111111",
  network: "astrontestnet",
  maxPriorityFeePerGasScale: 1,
  dryRun: false,
};

describe("title-escrow", () => {
  // increase timeout because ethers is throttling
  vi.setConfig({ testTimeout: 30_000 });
  vi.spyOn(global, "fetch").mockImplementation(
    vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            standard: {
              maxPriorityFee: 0,
              maxFee: 0,
            },
          }),
      })
    ) as any
  );

  describe("endorse transfer of owner of transferable record", () => {
    const mockedTradeTrustTokenFactory: Mock<typeof TradeTrustToken__factory> = TradeTrustToken__factory as any;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore mock static method
    const _mockedConnectERC721: Mock = mockedTradeTrustTokenFactory.connect;
    const mockedTokenFactory: Mock<typeof TitleEscrow__factory> = TitleEscrow__factory as any;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore mock static method
    const _mockedConnectTokenFactory: Mock = mockedTokenFactory.connect;

    const _mockedTitleEscrowAddress = "0x2133";
    const _mockedOwnerOf = vi.fn();

    const _mockTransferOwners = vi.fn();
    const _mockCallStaticTransferOwners = vi.fn().mockResolvedValue(undefined);

    const _mockedBeneficiary = "0xdssfs";
    const _mockGetBeneficiary = vi.fn();

    beforeEach(() => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(transferBeneficiaryImpl).mockResolvedValue({
        hash: "hash",
        wait: () => Promise.resolve({ transactionHash: "transactionHash" }),
      } as any);
    });

    it("should pass in the correct params and call the following procedures to invoke an endorsement of transfer of owner of a transferable record", async () => {
      const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
      await endorseNominatedBeneficiary({
        ...endorseNominatedBeneficiaryParams,
        key: privateKey,
      });

      expect(transferBeneficiaryImpl).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if nominee is the owner address", async () => {
      const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
      await expect(
        endorseNominatedBeneficiary({
          ...endorseNominatedBeneficiaryParams,
          newBeneficiary: "0x2222222222222222222222222222222222222222",
          key: privateKey,
        })
      ).rejects.toThrow(`new beneficiary address is the same as the current beneficiary address`);
    });
  });
});
