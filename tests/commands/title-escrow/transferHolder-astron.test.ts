import { v5Contracts, transferHolder as transferHolderImpl } from "@trustvc/trustvc";
import { beforeEach, describe, expect, it, vi, Mock } from "vitest";
import { TitleEscrowTransferHolderCommand } from "../../../src/types";
import { transferHolder } from "../../../src/implementations/title-escrow/transferHolder";

const { TitleEscrow__factory, TradeTrustToken__factory } = v5Contracts;
vi.mock("@trustvc/trustvc", async () => {
  const actual = await vi.importActual<typeof import("@trustvc/trustvc")>("@trustvc/trustvc");
  return {
    ...actual,
    transferHolder: vi.fn(),
  };
});

const transferHolderParams: TitleEscrowTransferHolderCommand = {
  newHolder: "0xabcd",
  tokenId: "0xzyxw",
  tokenRegistryAddress: "0x1234",
  network: "astron",
  maxPriorityFeePerGasScale: 1,
  dryRun: false,
};

describe("title-escrow", () => {
  describe("change holder of transferable record", () => {
    const mockedTradeTrustTokenFactory: Mock<typeof TradeTrustToken__factory> = TradeTrustToken__factory as any;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore mock static method
    const _mockedConnectERC721: Mock = mockedTradeTrustTokenFactory.connect;

    const mockedTokenFactory: Mock<typeof TitleEscrow__factory> = TitleEscrow__factory as any;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore mock static method
    const _mockedConnectTokenFactory: Mock = mockedTokenFactory.connect;
    const _mockedOwnerOf = vi.fn();
    const _mockTransferHolder = vi.fn();
    const _mockCallStaticTransferHolder = vi.fn().mockResolvedValue(undefined);
    const _mockedTitleEscrowAddress = "0x2133";

    beforeEach(() => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(transferHolderImpl).mockResolvedValue({
        hash: "hash",
        wait: () => Promise.resolve({ transactionHash: "transactionHash" }),
      } as any);
    });

    it("should pass in the correct params and call the following procedures to invoke a change in holder of a transferable record", async () => {
      const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
      await transferHolder({
        ...transferHolderParams,
        key: privateKey,
      });

      expect(transferHolderImpl).toHaveBeenCalledTimes(1);
    });
  });
});
