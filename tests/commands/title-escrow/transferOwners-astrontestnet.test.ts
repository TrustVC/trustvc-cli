import { transferOwners as transferOwnersImpl } from "@trustvc/trustvc";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TitleEscrowEndorseTransferOfOwnersCommand } from "../../../src/types";
import { transferOwners } from "../../../src/commands/title-escrow/endorse-change-of-owner";

vi.mock("@trustvc/trustvc", async () => {
  const actual = await vi.importActual<typeof import("@trustvc/trustvc")>("@trustvc/trustvc");
  return {
    ...actual,
    transferOwners: vi.fn(),
  };
});

vi.mock('../../../src/commands/helpers', () => {
  const mockTitleEscrow = {
    beneficiary: vi.fn().mockResolvedValue('0x3333333333333333333333333333333333333333'),
    holder: vi.fn().mockResolvedValue('0x4444444444444444444444444444444444444444'),
    transferOwners: {
      populateTransaction: vi.fn(),
    },
  };
  
  return {
    connectToTitleEscrow: vi.fn().mockResolvedValue(mockTitleEscrow),
    validateEndorseChangeOwner: vi.fn().mockImplementation(async ({ newOwner, newHolder, titleEscrow }) => {
      const beneficiary = await titleEscrow.beneficiary();
      const holder = await titleEscrow.holder();
      if (newOwner === beneficiary && newHolder === holder) {
        throw new Error('new owner and new holder addresses are the same as the current owner and holder addresses');
      }
    }),
    validateAndEncryptRemark: vi.fn().mockReturnValue('encrypted-remark'),
  };
});

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

const endorseChangeOwnersParams: TitleEscrowEndorseTransferOfOwnersCommand = {
  newHolder: "0x1111111111111111111111111111111111111111",
  newOwner: "0x2222222222222222222222222222222222222222",
  tokenId: "0x12345",
  tokenRegistryAddress: "0x1234567890123456789012345678901234567890",
  network: "astrontestnet",
  maxPriorityFeePerGasScale: 1,
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

  describe("endorse change of owners of transferable record", () => {
    beforeEach(async () => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(transferOwnersImpl).mockResolvedValue({
        hash: "hash",
        wait: () => Promise.resolve({ transactionHash: "transactionHash" }),
      } as any);

      const walletModule = await import('../../../src/utils/wallet');
      const getWalletOrSignerMock = walletModule.getWalletOrSigner as any;
      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
        getAddress: vi.fn().mockResolvedValue('0xfrom'),
      });

      const utils = await import('../../../src/utils');
      (utils.performDryRunWithConfirmation as any).mockResolvedValue(true);
    });

    it("should pass in the correct params and call the following procedures to invoke an endorsement of change of owner of a transferable record", async () => {
      const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
      await transferOwners({
        ...endorseChangeOwnersParams,
        key: privateKey,
      });

      expect(transferOwnersImpl).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if new owner and new holder addresses are the same as current owner and holder addressses", async () => {
      const privateKey = "0000000000000000000000000000000000000000000000000000000000000001";
      
      // Mock performDryRunWithConfirmation to execute the callback so validation runs
      const utils = await import('../../../src/utils');
      (utils.performDryRunWithConfirmation as any).mockImplementation(async ({ getTransactionCallback }: any) => {
        await getTransactionCallback();
        return true;
      });
      
      await expect(
        transferOwners({
          ...endorseChangeOwnersParams,
          newOwner: '0x3333333333333333333333333333333333333333',
          newHolder: '0x4444444444444444444444444444444444444444',
          key: privateKey,
        })
      ).rejects.toThrow("new owner and new holder addresses are the same as the current owner and holder addresses");
    });
  });
});
