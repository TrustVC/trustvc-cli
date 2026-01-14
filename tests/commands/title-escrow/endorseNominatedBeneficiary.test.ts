import { TransactionReceipt } from '@ethersproject/providers';
import * as prompts from '@inquirer/prompts';
import { transferBeneficiary as transferBeneficiaryImpl } from "@trustvc/trustvc";
import { beforeEach, describe, expect, it, vi, MockedFunction } from "vitest";
import { TitleEscrowNominateBeneficiaryCommand } from "../../../src/types";
import {
  endorseNominatedBeneficiary,
  endorseTransferOwnerHandler,
  handler,
  promptForInputs,
} from "../../../src/commands/title-escrow/endorse-transfer-of-owner";
import { NetworkCmdName } from '../../../src/utils';

vi.mock('@inquirer/prompts');

vi.mock('signale', async (importOriginal) => {
  const originalSignale = await importOriginal<typeof import('signale')>();
  return {
    ...originalSignale,
    Signale: class MockSignale {
      await = vi.fn();
      success = vi.fn();
      error = vi.fn();
      info = vi.fn();
      warn = vi.fn();
      constructor() {}
    },
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    default: {
      await: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  };
});

vi.mock("@trustvc/trustvc", async () => {
  const actual = await vi.importActual<typeof import("@trustvc/trustvc")>("@trustvc/trustvc");
  return {
    ...actual,
    transferBeneficiary: vi.fn(),
  };
});

vi.mock("../../../src/commands/helpers", () => ({
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

vi.mock('../../../src/utils/wallet', () => ({
  getWalletOrSigner: vi.fn(),
}));

vi.mock('../../../src/utils', async (importOriginal) => {
  const originalUtils = await importOriginal<typeof import('../../../src/utils')>();
  return {
    ...originalUtils,
    getErrorMessage: vi.fn((e: any) => (e instanceof Error ? e.message : String(e))),
    getEtherscanAddress: vi.fn(() => 'https://etherscan.io'),
    displayTransactionPrice: vi.fn(),
    canEstimateGasPrice: vi.fn(() => false),
    getGasFees: vi.fn(),
  };
});

const endorseNominatedBeneficiaryParams: TitleEscrowNominateBeneficiaryCommand = {
  tokenId: "0x12345",
  remark: "remark",
  encryptionKey: "1234",
  tokenRegistryAddress: "0x1234567890123456789012345678901234567890",
  newBeneficiary: "0x1111111111111111111111111111111111111111",
  network: "sepolia",
  maxPriorityFeePerGasScale: 1,
  dryRun: false,
};

describe('title-escrow/endorse-transfer-owner', () => {
  vi.setConfig({ testTimeout: 30_000 });
  vi.spyOn(global, 'fetch').mockImplementation(
    vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            standard: {
              maxPriorityFee: 0,
              maxFee: 0,
            },
          }),
      }),
    ) as any,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForInputs', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should return correct answers for valid inputs with encrypted wallet', async () => {
      const mockInputs = {
        network: NetworkCmdName.Sepolia,
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        newBeneficiary: '0x0987654321098765432109876543210987654321',
        remark: 'Test remark',
        encryptionKey: 'test-key',
      };

      (prompts.select as any)
        .mockResolvedValueOnce(mockInputs.network)
        .mockResolvedValueOnce('encryptedWallet');

      (prompts.input as any)
        .mockResolvedValueOnce(mockInputs.tokenRegistry)
        .mockResolvedValueOnce(mockInputs.tokenId)
        .mockResolvedValueOnce(mockInputs.newBeneficiary)
        .mockResolvedValueOnce('./wallet.json')
        .mockResolvedValueOnce(mockInputs.remark)
        .mockResolvedValueOnce(mockInputs.encryptionKey);

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);
      expect(result.tokenRegistryAddress).toBe(mockInputs.tokenRegistry);
      expect(result.tokenId).toBe(mockInputs.tokenId);
      expect(result.newBeneficiary).toBe(mockInputs.newBeneficiary);
      expect((result as any).encryptedWalletPath).toBe('./wallet.json');
      expect(result.remark).toBe(mockInputs.remark);
      expect(result.encryptionKey).toBe(mockInputs.encryptionKey);
      expect(result.dryRun).toBe(false);
      expect(result.maxPriorityFeePerGasScale).toBe(1);
    });

    it('should return correct answers for valid inputs with private key file', async () => {
      const mockInputs = {
        network: NetworkCmdName.Mainnet,
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        newBeneficiary: '0x0987654321098765432109876543210987654321',
      };

      (prompts.select as any).mockResolvedValueOnce(mockInputs.network).mockResolvedValueOnce('keyFile');

      (prompts.input as any)
        .mockResolvedValueOnce(mockInputs.tokenRegistry)
        .mockResolvedValueOnce(mockInputs.tokenId)
        .mockResolvedValueOnce(mockInputs.newBeneficiary)
        .mockResolvedValueOnce('./private-key.txt')
        .mockResolvedValueOnce('');

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);
      expect((result as any).keyFile).toBe('./private-key.txt');
      expect(result.remark).toBeUndefined();
      expect(result.encryptionKey).toBeUndefined();
    });

    it('should return correct answers for valid inputs with direct private key', async () => {
      const mockInputs = {
        network: NetworkCmdName.Sepolia,
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        newBeneficiary: '0x0987654321098765432109876543210987654321',
      };

      (prompts.select as any).mockResolvedValueOnce(mockInputs.network).mockResolvedValueOnce('keyDirect');

      (prompts.input as any)
        .mockResolvedValueOnce(mockInputs.tokenRegistry)
        .mockResolvedValueOnce(mockInputs.tokenId)
        .mockResolvedValueOnce(mockInputs.newBeneficiary)
        .mockResolvedValueOnce('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
        .mockResolvedValueOnce('');

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);
      expect((result as any).key).toBe('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    });

    it('should return correct answers when using environment variable for private key', async () => {
      const originalEnv = process.env.OA_PRIVATE_KEY;
      process.env.OA_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

      const mockInputs = {
        network: NetworkCmdName.Sepolia,
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        newBeneficiary: '0x0987654321098765432109876543210987654321',
      };

      (prompts.select as any).mockResolvedValueOnce(mockInputs.network).mockResolvedValueOnce('envVariable');

      (prompts.input as any)
        .mockResolvedValueOnce(mockInputs.tokenRegistry)
        .mockResolvedValueOnce(mockInputs.tokenId)
        .mockResolvedValueOnce(mockInputs.newBeneficiary)
        .mockResolvedValueOnce('');

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);
      expect((result as any).key).toBeUndefined();
      expect((result as any).keyFile).toBeUndefined();
      expect((result as any).encryptedWalletPath).toBeUndefined();

      if (originalEnv) {
        process.env.OA_PRIVATE_KEY = originalEnv;
      } else {
        delete process.env.OA_PRIVATE_KEY;
      }
    });

    it('should throw error when OA_PRIVATE_KEY environment variable is not set', async () => {
      const originalEnv = process.env.OA_PRIVATE_KEY;
      delete process.env.OA_PRIVATE_KEY;

      (prompts.select as any).mockResolvedValueOnce(NetworkCmdName.Sepolia).mockResolvedValueOnce('envVariable');

      (prompts.input as any)
        .mockResolvedValueOnce('0x1234567890123456789012345678901234567890')
        .mockResolvedValueOnce('0xabcdef1234567890')
        .mockResolvedValueOnce('0x0987654321098765432109876543210987654321');

      await expect(promptForInputs()).rejects.toThrowError(
        'OA_PRIVATE_KEY environment variable is not set. Please set it or choose another option.',
      );

      if (originalEnv) {
        process.env.OA_PRIVATE_KEY = originalEnv;
      }
    });
  });

  describe('endorseTransferOwnerHandler', () => {
    let transferBeneficiaryMock: MockedFunction<any>;
    let getWalletOrSignerMock: MockedFunction<any>;

    beforeEach(async () => {
      vi.clearAllMocks();

      const trustvcModule = await import('@trustvc/trustvc');
      transferBeneficiaryMock = trustvcModule.transferBeneficiary as MockedFunction<any>;

      const walletModule = await import('../../../src/utils/wallet');
      getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;

      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
      });
    });

    it('should successfully endorse transfer of owner and display transaction details', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        newBeneficiary: '0x0987654321098765432109876543210987654321',
        encryptedWalletPath: './wallet.json',
        dryRun: false,
        maxPriorityFeePerGasScale: 1,
      };

      const mockTransaction: TransactionReceipt = {
        transactionHash: '0xtxhash123',
        blockNumber: 12345,
        blockHash: '0xblockhash',
        confirmations: 1,
        from: '0xfrom',
        to: mockArgs.tokenRegistryAddress,
        gasUsed: { toNumber: () => 100000 } as any,
        cumulativeGasUsed: { toNumber: () => 100000 } as any,
        effectiveGasPrice: { toNumber: () => 1000000000 } as any,
        byzantium: true,
        type: 2,
        status: 1,
        contractAddress: '',
        transactionIndex: 0,
        logs: [],
        logsBloom: '0x',
      };

      transferBeneficiaryMock.mockResolvedValue({
        hash: mockTransaction.transactionHash,
        wait: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await endorseTransferOwnerHandler(mockArgs);

      expect(transferBeneficiaryMock).toHaveBeenCalled();
      expect(result).toBe(mockArgs.tokenRegistryAddress);
    });

    it('should handle endorse with remark and encryption key', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        newBeneficiary: '0x0987654321098765432109876543210987654321',
        remark: 'Important endorsement',
        encryptionKey: 'secret-key-123',
        key: '0xprivatekey',
        dryRun: false,
        maxPriorityFeePerGasScale: 1,
      };

      const mockTransaction: TransactionReceipt = {
        transactionHash: '0xtxhash456',
        blockNumber: 12346,
        blockHash: '0xblockhash2',
        confirmations: 1,
        from: '0xfrom',
        to: mockArgs.tokenRegistryAddress,
        gasUsed: { toNumber: () => 120000 } as any,
        cumulativeGasUsed: { toNumber: () => 120000 } as any,
        effectiveGasPrice: { toNumber: () => 1500000000 } as any,
        byzantium: true,
        type: 2,
        status: 1,
        contractAddress: '',
        transactionIndex: 0,
        logs: [],
        logsBloom: '0x',
      };

      transferBeneficiaryMock.mockResolvedValue({
        hash: mockTransaction.transactionHash,
        wait: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await endorseTransferOwnerHandler(mockArgs);

      expect(transferBeneficiaryMock).toHaveBeenCalled();
      expect(result).toBe(mockArgs.tokenRegistryAddress);
    });

    it('should handle errors during endorse', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        newBeneficiary: '0x0987654321098765432109876543210987654321',
        encryptedWalletPath: './wallet.json',
        dryRun: false,
        maxPriorityFeePerGasScale: 1,
      };

      const errorMessage = 'Transaction failed: insufficient funds';
      transferBeneficiaryMock.mockRejectedValue(new Error(errorMessage));

      const result = await endorseTransferOwnerHandler(mockArgs);

      expect(result).toBeUndefined();
      expect(transferBeneficiaryMock).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions during endorse', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        newBeneficiary: '0x0987654321098765432109876543210987654321',
        encryptedWalletPath: './wallet.json',
        dryRun: false,
        maxPriorityFeePerGasScale: 1,
      };

      transferBeneficiaryMock.mockRejectedValue('String error message');

      const result = await endorseTransferOwnerHandler(mockArgs);

      expect(result).toBeUndefined();
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should successfully execute the complete endorse transfer owner flow', async () => {
      const mockInputs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        newBeneficiary: '0x0987654321098765432109876543210987654321',
        encryptedWalletPath: './wallet.json',
        dryRun: false,
        maxPriorityFeePerGasScale: 1,
      };

      const mockTransaction: TransactionReceipt = {
        transactionHash: '0xtxhash',
        blockNumber: 12345,
        blockHash: '0xblockhash',
        confirmations: 1,
        from: '0xfrom',
        to: mockInputs.tokenRegistryAddress,
        gasUsed: { toNumber: () => 100000 } as any,
        cumulativeGasUsed: { toNumber: () => 100000 } as any,
        effectiveGasPrice: { toNumber: () => 1000000000 } as any,
        byzantium: true,
        type: 2,
        status: 1,
        contractAddress: '',
        transactionIndex: 0,
        logs: [],
        logsBloom: '0x',
      };

      (prompts.select as any)
        .mockResolvedValueOnce(mockInputs.network)
        .mockResolvedValueOnce('encryptedWallet');

      (prompts.input as any)
        .mockResolvedValueOnce(mockInputs.tokenRegistryAddress)
        .mockResolvedValueOnce(mockInputs.tokenId)
        .mockResolvedValueOnce(mockInputs.newBeneficiary)
        .mockResolvedValueOnce(mockInputs.encryptedWalletPath)
        .mockResolvedValueOnce('');

      const trustvcModule = await import('@trustvc/trustvc');
      const transferBeneficiaryMock = trustvcModule.transferBeneficiary as MockedFunction<any>;
      transferBeneficiaryMock.mockResolvedValue({
        hash: mockTransaction.transactionHash,
        wait: vi.fn().mockResolvedValue(mockTransaction),
      });

      const walletModule = await import('../../../src/utils/wallet');
      const getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;
      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
      });

      const result = await handler();

      expect(result).toBeUndefined();
    });

    it('should handle errors in handler', async () => {
      const errorMessage = 'Prompt error';
      (prompts.select as any).mockRejectedValue(new Error(errorMessage));

      await handler();

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith(errorMessage);
    });

    it('should handle non-Error exceptions in handler', async () => {
      const errorMessage = 'String error';
      (prompts.select as any).mockRejectedValue(errorMessage);

      await handler();

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe('endorseNominatedBeneficiary', () => {
    beforeEach(async () => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(transferBeneficiaryImpl).mockResolvedValue({
        hash: "hash",
        wait: () => Promise.resolve({ transactionHash: "transactionHash" }),
      } as any);

      const walletModule = await import('../../../src/utils/wallet');
      const getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;
      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
      });

      // Re-setup the helpers mocks
      const helpersModule = await import('../../../src/commands/helpers');
      const mockTitleEscrow = {
        beneficiary: vi.fn().mockResolvedValue('0x3333333333333333333333333333333333333333'),
      };

      const connectToTitleEscrowMock = helpersModule.connectToTitleEscrow as MockedFunction<any>;
      connectToTitleEscrowMock.mockResolvedValue(mockTitleEscrow);

      const validateNominateBeneficiaryMock = helpersModule.validateNominateBeneficiary as MockedFunction<any>;
      validateNominateBeneficiaryMock.mockImplementation(async ({ beneficiaryNominee }: any) => {
        if (beneficiaryNominee === '0x2222222222222222222222222222222222222222') {
          throw new Error('new beneficiary address is the same as the current beneficiary address');
        }
      });
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
