import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  handler,
  transferOwnershipOfDocumentStore,
  promptForInputs,
} from '../../../src/commands/document-store/transfer-ownership';
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
      constructor() {}
    },
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  };
});

vi.mock('@trustvc/trustvc', () => ({
  documentStoreTransferOwnership: vi.fn(),
  v5Contracts: {
    TitleEscrow__factory: {},
    TradeTrustToken__factory: {},
  },
  checkSupportsInterface: vi.fn(),
  v4SupportInterfaceIds: {},
  v5SupportInterfaceIds: {},
  encrypt: vi.fn(),
  DocumentStore__factory: {
    connect: vi.fn(),
  },
  SUPPORTED_CHAINS: {
    1: {
      name: 'mainnet',
      explorerUrl: 'https://etherscan.io',
      rpcUrl: 'https://mainnet.infura.io/v3/test',
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
    },
    11155111: {
      name: 'sepolia',
      explorerUrl: 'https://sepolia.etherscan.io',
      rpcUrl: 'https://sepolia.infura.io/v3/test',
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
    },
    137: {
      name: 'matic',
      explorerUrl: 'https://polygonscan.com',
      rpcUrl: 'https://polygon-mainnet.infura.io/v3/test',
      nativeCurrency: { symbol: 'MATIC', decimals: 18 },
    },
  },
  CHAIN_ID: {
    mainnet: 1,
    sepolia: 11155111,
    matic: 137,
  },
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
    extractOADocumentInfo: vi.fn(),
    promptAddress: vi.fn(),
    promptWalletSelection: vi.fn(),
    performDryRunWithConfirmation: vi.fn(async () => true),
  };
});

vi.mock('../../../src/commands/helpers', () => ({
  connectToDocumentStore: vi.fn(async () => ({
    grantRole: {
      populateTransaction: vi.fn(),
      callStatic: vi.fn(),
    },
    revokeRole: {
      populateTransaction: vi.fn(),
      callStatic: vi.fn(),
    },
  })),
  waitForTransaction: vi.fn(),
}));

describe('document-store/transfer-ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForInputs', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should return correct answers with encrypted wallet', async () => {
      const mockInputs = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        newOwner: '0x9876543210987654321098765432109876543210',
      };

      const mockDocument = {
        data: {
          issuers: [
            {
              documentStore: mockInputs.documentStoreAddress,
            },
          ],
        },
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractOADocumentInfo as any).mockResolvedValue({
        documentStoreAddress: mockInputs.documentStoreAddress,
        network: NetworkCmdName.Sepolia,
      });

      (utils.promptAddress as any).mockResolvedValue(mockInputs.newOwner);
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });

      const result = await promptForInputs();

      expect(result.documentStoreAddress).toBe(mockInputs.documentStoreAddress);
      expect(result.newOwner).toBe(mockInputs.newOwner);
      expect(result.network).toBe(NetworkCmdName.Sepolia);
      expect(result.maxPriorityFeePerGasScale).toBe(1);
      expect((result as any).encryptedWalletPath).toBe('./wallet.json');
    });

    it('should return correct answers with private key file', async () => {
      const mockInputs = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        newOwner: '0x9876543210987654321098765432109876543210',
      };

      const mockDocument = {
        data: {
          issuers: [
            {
              documentStore: mockInputs.documentStoreAddress,
            },
          ],
        },
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractOADocumentInfo as any).mockResolvedValue({
        documentStoreAddress: mockInputs.documentStoreAddress,
        network: NetworkCmdName.Mainnet,
      });

      (utils.promptAddress as any).mockResolvedValue(mockInputs.newOwner);
      (utils.promptWalletSelection as any).mockResolvedValue({
        keyFile: './private-key.txt',
      });

      const result = await promptForInputs();

      expect(result.newOwner).toBe(mockInputs.newOwner);
      expect((result as any).keyFile).toBe('./private-key.txt');
    });

    it('should return correct answers with direct private key', async () => {
      const mockInputs = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        newOwner: '0x9876543210987654321098765432109876543210',
      };

      const mockDocument = {
        data: {
          issuers: [
            {
              documentStore: mockInputs.documentStoreAddress,
            },
          ],
        },
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractOADocumentInfo as any).mockResolvedValue({
        documentStoreAddress: mockInputs.documentStoreAddress,
        network: NetworkCmdName.Matic,
      });

      (utils.promptAddress as any).mockResolvedValue(mockInputs.newOwner);
      (utils.promptWalletSelection as any).mockResolvedValue({
        key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      });

      const result = await promptForInputs();

      expect(result.newOwner).toBe(mockInputs.newOwner);
      expect((result as any).key).toBe(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      );
    });

    it('should throw error when document file reading fails', async () => {
      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockRejectedValue(
        new Error('Failed to read document file: File does not exist'),
      );

      await expect(promptForInputs()).rejects.toThrowError(
        'Failed to read document file: File does not exist',
      );
    });

    it('should throw error when document extraction fails', async () => {
      const mockDocument = { data: {} };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractOADocumentInfo as any).mockRejectedValue(
        new Error('Invalid document format: missing document store address'),
      );

      await expect(promptForInputs()).rejects.toThrowError(
        'Invalid document format: missing document store address',
      );
    });
  });

  describe('transferOwnershipOfDocumentStore', () => {
    let documentStoreTransferOwnershipMock: MockedFunction<any>;
    let getWalletOrSignerMock: MockedFunction<any>;
    let waitForTransactionMock: MockedFunction<any>;

    beforeEach(async () => {
      vi.clearAllMocks();

      const trustvcModule = await import('@trustvc/trustvc');
      documentStoreTransferOwnershipMock =
        trustvcModule.documentStoreTransferOwnership as MockedFunction<any>;

      const walletModule = await import('../../../src/utils/wallet');
      getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;

      const helpersModule = await import('../../../src/commands/helpers');
      waitForTransactionMock = helpersModule.waitForTransaction as MockedFunction<any>;

      // Setup wallet mock
      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
        getAddress: vi.fn().mockResolvedValue('0xsigner'),
      });

      // Re-setup performDryRunWithConfirmation to always return true (proceed)
      const utils = await import('../../../src/utils');
      (utils.performDryRunWithConfirmation as any).mockResolvedValue(true);
    });

    it('should successfully transfer ownership and display both transaction details', async () => {
      const mockArgs: any = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        newOwner: '0x9876543210987654321098765432109876543210',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const mockGrantTransaction = {
        hash: '0xgranttxhash123',
        wait: vi.fn().mockResolvedValue({
          hash: '0xgranttxhash123',
          blockNumber: 12345,
          gasUsed: BigInt(100000),
        }),
      };

      const mockRevokeTransaction = {
        hash: '0xrevoketxhash456',
        wait: vi.fn().mockResolvedValue({
          hash: '0xrevoketxhash456',
          blockNumber: 12346,
          gasUsed: BigInt(100000),
        }),
      };

      documentStoreTransferOwnershipMock.mockResolvedValue({
        grantTransaction: mockGrantTransaction,
        revokeTransaction: mockRevokeTransaction,
      });

      waitForTransactionMock
        .mockResolvedValueOnce({
          hash: '0xgranttxhash123',
          blockNumber: 12345,
        })
        .mockResolvedValueOnce({
          hash: '0xrevoketxhash456',
          blockNumber: 12346,
        });

      const result = await transferOwnershipOfDocumentStore(mockArgs);

      expect(documentStoreTransferOwnershipMock).toHaveBeenCalled();
      expect(waitForTransactionMock).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockArgs.documentStoreAddress);
    });

    it('should handle gas estimation for networks that support it', async () => {
      const mockArgs: any = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        newOwner: '0x9876543210987654321098765432109876543210',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const utils = await import('../../../src/utils');
      (utils.canEstimateGasPrice as any).mockReturnValue(true);
      (utils.getGasFees as any).mockResolvedValue({
        maxFeePerGas: BigInt(1000000000),
        maxPriorityFeePerGas: BigInt(1000000000),
      });

      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
        getAddress: vi.fn().mockResolvedValue('0xsigner'),
      });

      const mockGrantTransaction = {
        hash: '0xgranttxhash',
        wait: vi.fn().mockResolvedValue({}),
      };

      const mockRevokeTransaction = {
        hash: '0xrevoketxhash',
        wait: vi.fn().mockResolvedValue({}),
      };

      documentStoreTransferOwnershipMock.mockResolvedValue({
        grantTransaction: mockGrantTransaction,
        revokeTransaction: mockRevokeTransaction,
      });

      waitForTransactionMock.mockResolvedValue({});

      await transferOwnershipOfDocumentStore(mockArgs);

      expect(utils.getGasFees).toHaveBeenCalled();
      expect(documentStoreTransferOwnershipMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          maxFeePerGas: expect.any(String),
          maxPriorityFeePerGas: expect.any(String),
        }),
      );
    });

    it('should handle errors during transfer ownership execution', async () => {
      const mockArgs: any = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        newOwner: '0x9876543210987654321098765432109876543210',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const errorMessage = 'Transaction failed: insufficient funds';
      documentStoreTransferOwnershipMock.mockRejectedValue(new Error(errorMessage));

      const result = await transferOwnershipOfDocumentStore(mockArgs);

      expect(result).toBeUndefined();
      expect(documentStoreTransferOwnershipMock).toHaveBeenCalled();
    });

    it('should handle errors when provider is not available for gas estimation', async () => {
      const mockArgs: any = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        newOwner: '0x9876543210987654321098765432109876543210',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const utils = await import('../../../src/utils');
      (utils.canEstimateGasPrice as any).mockReturnValue(true);

      getWalletOrSignerMock.mockResolvedValue({
        provider: null,
        getAddress: vi.fn().mockResolvedValue('0xsigner'),
      });

      const result = await transferOwnershipOfDocumentStore(mockArgs);

      expect(result).toBeUndefined();
    });

    it('should handle missing grant or revoke transaction', async () => {
      const mockArgs: any = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        newOwner: '0x9876543210987654321098765432109876543210',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      documentStoreTransferOwnershipMock.mockResolvedValue({
        grantTransaction: null,
        revokeTransaction: null,
      });

      const result = await transferOwnershipOfDocumentStore(mockArgs);

      expect(result).toBeUndefined();
    });

    it('should handle transaction wait errors', async () => {
      const mockArgs: any = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        newOwner: '0x9876543210987654321098765432109876543210',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const mockGrantTransaction = {
        hash: '0xgranttxhash',
        wait: vi.fn().mockRejectedValue(new Error('Transaction reverted')),
      };

      const mockRevokeTransaction = {
        hash: '0xrevoketxhash',
        wait: vi.fn().mockResolvedValue({}),
      };

      documentStoreTransferOwnershipMock.mockResolvedValue({
        grantTransaction: mockGrantTransaction,
        revokeTransaction: mockRevokeTransaction,
      });

      waitForTransactionMock.mockRejectedValue(new Error('Transaction reverted'));

      const result = await transferOwnershipOfDocumentStore(mockArgs);

      expect(result).toBeUndefined();
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should successfully execute the complete transfer ownership flow', async () => {
      const mockInputs: any = {
        network: NetworkCmdName.Sepolia,
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        newOwner: '0x9876543210987654321098765432109876543210',
        encryptedWalletPath: './wallet.json',
        maxPriorityFeePerGasScale: 1,
      };

      const mockDocument = {
        data: {
          issuers: [
            {
              documentStore: mockInputs.documentStoreAddress,
            },
          ],
        },
      };

      const mockGrantTransaction = {
        hash: '0xgranttxhash',
        wait: vi.fn().mockResolvedValue({
          hash: '0xgranttxhash',
          blockNumber: 12345,
        }),
      };

      const mockRevokeTransaction = {
        hash: '0xrevoketxhash',
        wait: vi.fn().mockResolvedValue({
          hash: '0xrevoketxhash',
          blockNumber: 12346,
        }),
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractOADocumentInfo as any).mockResolvedValue({
        documentStoreAddress: mockInputs.documentStoreAddress,
        network: mockInputs.network,
      });

      (utils.promptAddress as any).mockResolvedValue(mockInputs.newOwner);
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: mockInputs.encryptedWalletPath,
      });

      const trustvcModule = await import('@trustvc/trustvc');
      const transferOwnershipMock =
        trustvcModule.documentStoreTransferOwnership as MockedFunction<any>;
      transferOwnershipMock.mockResolvedValue({
        grantTransaction: mockGrantTransaction,
        revokeTransaction: mockRevokeTransaction,
      });

      const walletModule = await import('../../../src/utils/wallet');
      const getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;
      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
        getAddress: vi.fn().mockResolvedValue('0xsigner'),
      });

      const helpersModule = await import('../../../src/commands/helpers');
      const waitForTransactionMock = helpersModule.waitForTransaction as MockedFunction<any>;
      waitForTransactionMock.mockResolvedValue({
        hash: '0xtxhash',
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

    it('should return early if promptForInputs returns falsy value', async () => {
      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(null);

      const trustvcModule = await import('@trustvc/trustvc');
      const transferOwnershipMock =
        trustvcModule.documentStoreTransferOwnership as MockedFunction<any>;

      await handler();

      expect(transferOwnershipMock).not.toHaveBeenCalled();
    });
  });
});
