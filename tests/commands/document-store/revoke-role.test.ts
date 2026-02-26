import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  handler,
  revokeRoleFromDocumentStore,
  promptForInputs,
} from '../../../src/commands/document-store/revoke-role';
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

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
  password: vi.fn(),
}));

vi.mock('@trustvc/trustvc', () => ({
  documentStoreRevokeRole: vi.fn(),
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
    revokeRole: {
      populateTransaction: vi.fn(),
      callStatic: vi.fn(),
    },
  })),
  waitForTransaction: vi.fn(),
}));

describe('document-store/revoke-role', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForInputs', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should return correct answers for ISSUER_ROLE with encrypted wallet', async () => {
      const mockInputs = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        account: '0x9876543210987654321098765432109876543210',
        role: 'ISSUER_ROLE',
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

      const inquirer = await import('@inquirer/prompts');
      (inquirer.select as any).mockResolvedValue(mockInputs.role);

      (utils.promptAddress as any).mockResolvedValue(mockInputs.account);
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });

      const result = await promptForInputs();

      expect(result.documentStoreAddress).toBe(mockInputs.documentStoreAddress);
      expect(result.role).toBe(mockInputs.role);
      expect(result.account).toBe(mockInputs.account);
      expect(result.network).toBe(NetworkCmdName.Sepolia);
      expect(result.maxPriorityFeePerGasScale).toBe(1);
      expect((result as any).encryptedWalletPath).toBe('./wallet.json');
    });

    it('should return correct answers for REVOKER_ROLE with private key file', async () => {
      const mockInputs = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        account: '0x9876543210987654321098765432109876543210',
        role: 'REVOKER_ROLE',
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

      const inquirer = await import('@inquirer/prompts');
      (inquirer.select as any).mockResolvedValue(mockInputs.role);

      (utils.promptAddress as any).mockResolvedValue(mockInputs.account);
      (utils.promptWalletSelection as any).mockResolvedValue({
        keyFile: './private-key.txt',
      });

      const result = await promptForInputs();

      expect(result.role).toBe(mockInputs.role);
      expect((result as any).keyFile).toBe('./private-key.txt');
    });

    it('should return correct answers for DEFAULT_ADMIN_ROLE with direct private key', async () => {
      const mockInputs = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        account: '0x9876543210987654321098765432109876543210',
        role: 'DEFAULT_ADMIN_ROLE',
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

      const inquirer = await import('@inquirer/prompts');
      (inquirer.select as any).mockResolvedValue(mockInputs.role);

      (utils.promptAddress as any).mockResolvedValue(mockInputs.account);
      (utils.promptWalletSelection as any).mockResolvedValue({
        key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      });

      const result = await promptForInputs();

      expect(result.role).toBe(mockInputs.role);
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
  });

  describe('revokeRoleFromDocumentStore', () => {
    let documentStoreRevokeRoleMock: MockedFunction<any>;
    let getWalletOrSignerMock: MockedFunction<any>;
    let connectToDocumentStoreMock: MockedFunction<any>;
    let waitForTransactionMock: MockedFunction<any>;

    beforeEach(async () => {
      vi.clearAllMocks();

      const trustvcModule = await import('@trustvc/trustvc');
      documentStoreRevokeRoleMock = trustvcModule.documentStoreRevokeRole as MockedFunction<any>;

      const walletModule = await import('../../../src/utils/wallet');
      getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;

      const helpersModule = await import('../../../src/commands/helpers');
      connectToDocumentStoreMock = helpersModule.connectToDocumentStore as MockedFunction<any>;
      waitForTransactionMock = helpersModule.waitForTransaction as MockedFunction<any>;

      // Setup wallet mock
      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
        getAddress: vi.fn().mockResolvedValue('0xsigner'),
      });

      // Setup document store mock
      connectToDocumentStoreMock.mockResolvedValue({
        revokeRole: {
          populateTransaction: vi.fn().mockResolvedValue({
            to: '0xdocstore',
            data: '0xdata',
          }),
          callStatic: vi.fn().mockResolvedValue(undefined),
        },
      });

      // Re-setup performDryRunWithConfirmation to always return true (proceed)
      const utils = await import('../../../src/utils');
      (utils.performDryRunWithConfirmation as any).mockResolvedValue(true);
    });

    it('should successfully revoke ISSUER_ROLE and display transaction details', async () => {
      const mockArgs: any = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        role: 'ISSUER_ROLE',
        account: '0x9876543210987654321098765432109876543210',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const mockTransaction = {
        hash: '0xtxhash123',
        wait: vi.fn().mockResolvedValue({
          transactionHash: '0xtxhash123',
          blockNumber: 12345,
          gasUsed: { toString: () => '100000' },
        }),
      };

      documentStoreRevokeRoleMock.mockResolvedValue(mockTransaction);
      waitForTransactionMock.mockResolvedValue({
        transactionHash: '0xtxhash123',
        blockNumber: 12345,
      });

      const result = await revokeRoleFromDocumentStore(mockArgs);

      expect(documentStoreRevokeRoleMock).toHaveBeenCalled();
      expect(result).toBe(mockArgs.documentStoreAddress);
    });

    it('should handle errors during revoke role execution', async () => {
      const mockArgs: any = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        role: 'ISSUER_ROLE',
        account: '0x9876543210987654321098765432109876543210',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const errorMessage = 'Transaction failed: insufficient funds';
      documentStoreRevokeRoleMock.mockRejectedValue(new Error(errorMessage));

      const result = await revokeRoleFromDocumentStore(mockArgs);

      expect(result).toBeUndefined();
      expect(documentStoreRevokeRoleMock).toHaveBeenCalled();
    });

    it('should handle callStatic errors for dry run', async () => {
      const mockArgs: any = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        role: 'ISSUER_ROLE',
        account: '0x9876543210987654321098765432109876543210',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      connectToDocumentStoreMock.mockResolvedValue({
        revokeRole: {
          populateTransaction: vi.fn().mockRejectedValue(new Error('Call static failed')),
          callStatic: vi.fn().mockRejectedValue(new Error('Call static failed')),
        },
      });

      const result = await revokeRoleFromDocumentStore(mockArgs);

      expect(result).toBeUndefined();
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should handle errors in handler', async () => {
      const errorMessage = 'Prompt error';
      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockRejectedValue(new Error(errorMessage));

      await handler();

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith(errorMessage);
    });
  });
});
