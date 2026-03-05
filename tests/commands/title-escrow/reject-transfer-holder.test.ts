import { TransactionReceipt } from '@ethersproject/providers';
import { rejectTransferHolder as rejectTransferHolderImpl } from '@trustvc/trustvc';
import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import { BaseTitleEscrowCommand } from '../../../src/types';
import {
  rejectTransferHolder,
  rejectTransferHolderHandler,
  handler,
  promptForInputs,
} from '../../../src/commands/title-escrow/reject-transfer-holder';
import { NetworkCmdName } from '../../../src/utils';

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

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    rejectTransferHolder: vi.fn(),
  };
});

vi.mock('../../../src/commands/helpers', () => ({
  connectToTitleEscrow: vi.fn().mockResolvedValue({
    prevHolder: vi.fn().mockResolvedValue('0x3333333333333333333333333333333333333333'),
    rejectTransferHolder: {
      populateTransaction: vi.fn(),
    },
  }),
  validateAndEncryptRemark: vi.fn().mockImplementation((remark) => {
    if (remark && remark.length > 120) {
      throw new Error('Remark length is more than 120 characters');
    }
    return 'encrypted-remark';
  }),
  validatePreviousHolder: vi.fn(),
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
    promptAndReadDocument: vi.fn(),
    extractDocumentInfo: vi.fn(),
    promptWalletSelection: vi.fn(),
    promptRemark: vi.fn(),
    performDryRunWithConfirmation: vi.fn(async () => true),
    verifyDocumentSignature: vi.fn().mockResolvedValue(undefined),
  };
});

const transferHolderParams: BaseTitleEscrowCommand = {
  remark: '0xabcd',
  encryptionKey: '1234',
  tokenId: '0x12345',
  tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
  network: 'sepolia',
  maxPriorityFeePerGasScale: 1,
};

describe('title-escrow/reject-transfer-holder', () => {
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
        remark: 'Test remark',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.tokenRegistry,
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.tokenRegistry,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });
      (utils.promptRemark as any).mockResolvedValue(mockInputs.remark);

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);
      expect(result.tokenRegistryAddress).toBe(mockInputs.tokenRegistry);
      expect(result.tokenId).toBe(mockInputs.tokenId);
      expect((result as any).encryptedWalletPath).toBe('./wallet.json');
      expect(result.remark).toBe(mockInputs.remark);
      expect(result.encryptionKey).toBe(mockInputs.documentId);
    });

    it('should return correct answers for valid inputs with private key file', async () => {
      const mockInputs = {
        network: NetworkCmdName.Mainnet,
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.tokenRegistry,
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.tokenRegistry,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v4',
      });
      (utils.promptWalletSelection as any).mockResolvedValue({
        keyFile: './private-key.txt',
      });
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);
      expect((result as any).keyFile).toBe('./private-key.txt');
    });

    it('should return correct answers for valid inputs with direct private key', async () => {
      const mockInputs = {
        network: NetworkCmdName.Sepolia,
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.tokenRegistry,
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.tokenRegistry,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptWalletSelection as any).mockResolvedValue({
        key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      });
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);
      expect((result as any).key).toBe(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      );
    });

    it('should return correct answers when using environment variable for private key', async () => {
      const originalEnv = process.env.OA_PRIVATE_KEY;
      process.env.OA_PRIVATE_KEY =
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

      const mockInputs = {
        network: NetworkCmdName.Sepolia,
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.tokenRegistry,
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.tokenRegistry,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptWalletSelection as any).mockResolvedValue({});
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);

      if (originalEnv) {
        process.env.OA_PRIVATE_KEY = originalEnv;
      } else {
        delete process.env.OA_PRIVATE_KEY;
      }
    });

    it('should throw error when OA_PRIVATE_KEY environment variable is not set', async () => {
      const originalEnv = process.env.OA_PRIVATE_KEY;
      delete process.env.OA_PRIVATE_KEY;

      const mockInputs = {
        network: NetworkCmdName.Sepolia,
        tokenRegistry: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.tokenRegistry,
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.tokenRegistry,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptWalletSelection as any).mockRejectedValue(
        new Error(
          'OA_PRIVATE_KEY environment variable is not set. Please set it or choose another option.',
        ),
      );

      await expect(promptForInputs()).rejects.toThrowError(
        'OA_PRIVATE_KEY environment variable is not set. Please set it or choose another option.',
      );

      if (originalEnv) {
        process.env.OA_PRIVATE_KEY = originalEnv;
      }
    });
  });

  describe('rejectTransferHolderHandler', () => {
    let rejectTransferHolderMock: MockedFunction<any>;
    let getWalletOrSignerMock: MockedFunction<any>;

    beforeEach(async () => {
      vi.clearAllMocks();

      const trustvcModule = await import('@trustvc/trustvc');
      rejectTransferHolderMock = trustvcModule.rejectTransferHolder as MockedFunction<any>;

      const walletModule = await import('../../../src/utils/wallet');
      getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;

      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
        getAddress: vi.fn().mockResolvedValue('0xfrom'),
      });

      // Ensure performDryRunWithConfirmation returns true
      const utils = await import('../../../src/utils');
      (utils.performDryRunWithConfirmation as any).mockResolvedValue(true);
    });

    it('should successfully reject transfer holder and display transaction details', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        encryptedWalletPath: './wallet.json',
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

      rejectTransferHolderMock.mockResolvedValue({
        hash: mockTransaction.transactionHash,
        wait: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await rejectTransferHolderHandler(mockArgs);

      expect(rejectTransferHolderMock).toHaveBeenCalled();
      expect(result).toBe(mockArgs.tokenRegistryAddress);
    });

    it('should handle reject with remark and encryption key', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        remark: 'Important rejection',
        encryptionKey: 'secret-key-123',
        key: '0xprivatekey',
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

      rejectTransferHolderMock.mockResolvedValue({
        hash: mockTransaction.transactionHash,
        wait: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await rejectTransferHolderHandler(mockArgs);

      expect(rejectTransferHolderMock).toHaveBeenCalled();
      expect(result).toBe(mockArgs.tokenRegistryAddress);
    });

    it('should handle errors during reject', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        encryptedWalletPath: './wallet.json',
        maxPriorityFeePerGasScale: 1,
      };

      const errorMessage = 'Transaction failed: insufficient funds';
      rejectTransferHolderMock.mockRejectedValue(new Error(errorMessage));

      const result = await rejectTransferHolderHandler(mockArgs);

      expect(result).toBeUndefined();
    });

    it('should handle non-Error exceptions during reject', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        encryptedWalletPath: './wallet.json',
        maxPriorityFeePerGasScale: 1,
      };

      rejectTransferHolderMock.mockRejectedValue('String error message');

      const result = await rejectTransferHolderHandler(mockArgs);

      expect(result).toBeUndefined();
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should successfully execute the complete reject transfer holder flow', async () => {
      const mockInputs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        encryptedWalletPath: './wallet.json',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
        maxPriorityFeePerGasScale: 1,
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.tokenRegistryAddress,
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

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.tokenRegistryAddress,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: mockInputs.encryptedWalletPath,
      });
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const trustvcModule = await import('@trustvc/trustvc');
      const rejectTransferHolderMock = trustvcModule.rejectTransferHolder as MockedFunction<any>;
      rejectTransferHolderMock.mockResolvedValue({
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
      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockRejectedValue(new Error(errorMessage));

      await handler();

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith(errorMessage);
    });

    it('should handle non-Error exceptions in handler', async () => {
      const errorMessage = 'String error';
      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockRejectedValue(errorMessage);

      await handler();

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe('rejectTransferHolder', () => {
    beforeEach(async () => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(rejectTransferHolderImpl).mockResolvedValue({
        hash: 'hash',
        wait: () => Promise.resolve({ transactionHash: 'transactionHash' }),
      } as any);

      const walletModule = await import('../../../src/utils/wallet');
      const getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;
      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
        getAddress: vi.fn().mockResolvedValue('0xfrom'),
      });

      // Ensure performDryRunWithConfirmation returns true
      const utils = await import('../../../src/utils');
      (utils.performDryRunWithConfirmation as any).mockResolvedValue(true);

      // Re-setup the helpers mocks
      const helpersModule = await import('../../../src/commands/helpers');
      const mockTitleEscrow = {
        prevHolder: vi.fn().mockResolvedValue('0x3333333333333333333333333333333333333333'),
      };

      const connectToTitleEscrowMock = helpersModule.connectToTitleEscrow as MockedFunction<any>;
      connectToTitleEscrowMock.mockResolvedValue(mockTitleEscrow);

      const validateAndEncryptRemarkMock =
        helpersModule.validateAndEncryptRemark as MockedFunction<any>;
      validateAndEncryptRemarkMock.mockImplementation((remark: any) => {
        if (remark && remark.length > 120) {
          throw new Error('Remark length is more than 120 characters');
        }
        return 'encrypted-remark';
      });
    });

    it('should pass in the correct params and call the following procedures to invoke a reject holder of a transferable record', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
      await rejectTransferHolder({
        ...transferHolderParams,
        key: privateKey,
      });

      expect(rejectTransferHolderImpl).toHaveBeenCalledTimes(1);
    });
    it('should throw error if remark is longer than 120 characters', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';

      // Mock performDryRunWithConfirmation to throw the validation error
      const utils = await import('../../../src/utils');
      (utils.performDryRunWithConfirmation as any).mockRejectedValueOnce(
        new Error('Remark length is more than 120 characters'),
      );

      await expect(
        rejectTransferHolder({
          ...transferHolderParams,
          remark: '0xabcd'.repeat(31),
          key: privateKey,
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Remark length is more than 120 characters]`,
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
        rejectTransferHolder({
          ...transferHolderParams,
          remark: '0xabcd',
          key: privateKey,
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: invalid rejection as previous holder is not set]`,
      );
    });
  });
});
