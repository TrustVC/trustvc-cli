import { TransactionReceipt } from '@ethersproject/providers';
import * as prompts from '@inquirer/prompts';
import { acceptReturned as acceptReturnedImpl } from '@trustvc/trustvc';
import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import { BaseTitleEscrowCommand as TitleEscrowReturnDocumentCommand } from '../../../src/types';
import {
  acceptReturned,
  acceptReturnedDocumentHandler,
  handler,
  promptForInputs,
} from '../../../src/commands/title-escrow/accept-returned';
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

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    acceptReturned: vi.fn(),
  };
});

vi.mock('../../../src/commands/helpers', () => ({
  validateAndEncryptRemark: vi.fn().mockReturnValue('encrypted-remark'),
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
const acceptReturnedDocumentParams: TitleEscrowReturnDocumentCommand = {
  tokenRegistryAddress: '0x1122',
  tokenId: '0x12345',
  remark: 'remark',
  encryptionKey: 'encryptionKey',
  network: 'sepolia',
  maxPriorityFeePerGasScale: 1,
  dryRun: false,
};
describe('title-escrow/accept-returned', () => {
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
        encryptionKey: 'test-key',
      };

      (prompts.select as any)
        .mockResolvedValueOnce(mockInputs.network)
        .mockResolvedValueOnce('encryptedWallet');

      (prompts.input as any)
        .mockResolvedValueOnce(mockInputs.tokenRegistry)
        .mockResolvedValueOnce(mockInputs.tokenId)
        .mockResolvedValueOnce('./wallet.json')
        .mockResolvedValueOnce(mockInputs.remark)
        .mockResolvedValueOnce(mockInputs.encryptionKey);

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);
      expect(result.tokenRegistryAddress).toBe(mockInputs.tokenRegistry);
      expect(result.tokenId).toBe(mockInputs.tokenId);
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
      };

      (prompts.select as any).mockResolvedValueOnce(mockInputs.network).mockResolvedValueOnce('keyFile');

      (prompts.input as any)
        .mockResolvedValueOnce(mockInputs.tokenRegistry)
        .mockResolvedValueOnce(mockInputs.tokenId)
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
      };

      (prompts.select as any).mockResolvedValueOnce(mockInputs.network).mockResolvedValueOnce('keyDirect');

      (prompts.input as any)
        .mockResolvedValueOnce(mockInputs.tokenRegistry)
        .mockResolvedValueOnce(mockInputs.tokenId)
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
      };

      (prompts.select as any).mockResolvedValueOnce(mockInputs.network).mockResolvedValueOnce('envVariable');

      (prompts.input as any)
        .mockResolvedValueOnce(mockInputs.tokenRegistry)
        .mockResolvedValueOnce(mockInputs.tokenId)
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
        .mockResolvedValueOnce('0xabcdef1234567890');

      await expect(promptForInputs()).rejects.toThrowError(
        'OA_PRIVATE_KEY environment variable is not set. Please set it or choose another option.',
      );

      if (originalEnv) {
        process.env.OA_PRIVATE_KEY = originalEnv;
      }
    });
  });

  describe('acceptReturnedDocumentHandler', () => {
    let acceptReturnedMock: MockedFunction<any>;
    let getWalletOrSignerMock: MockedFunction<any>;

    beforeEach(async () => {
      vi.clearAllMocks();

      const trustvcModule = await import('@trustvc/trustvc');
      acceptReturnedMock = trustvcModule.acceptReturned as MockedFunction<any>;

      const walletModule = await import('../../../src/utils/wallet');
      getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;

      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
      });
    });

    it('should successfully accept returned document and display transaction details', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
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

      acceptReturnedMock.mockResolvedValue({
        hash: mockTransaction.transactionHash,
        wait: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await acceptReturnedDocumentHandler(mockArgs);

      expect(acceptReturnedMock).toHaveBeenCalledWith(
        { tokenRegistryAddress: mockArgs.tokenRegistryAddress },
        expect.anything(),
        expect.objectContaining({
          tokenId: mockArgs.tokenId,
        }),
        expect.anything(),
      );
      expect(result).toBe(mockArgs.tokenRegistryAddress);
    });

    it('should handle accept returned with remark and encryption key', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        remark: 'Important document',
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

      acceptReturnedMock.mockResolvedValue({
        hash: mockTransaction.transactionHash,
        wait: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await acceptReturnedDocumentHandler(mockArgs);

      expect(acceptReturnedMock).toHaveBeenCalledWith(
        { tokenRegistryAddress: mockArgs.tokenRegistryAddress },
        expect.anything(),
        expect.objectContaining({
          tokenId: mockArgs.tokenId,
          remarks: mockArgs.remark,
        }),
        expect.objectContaining({
          id: mockArgs.encryptionKey,
        }),
      );
      expect(result).toBe(mockArgs.tokenRegistryAddress);
    });

    it('should handle errors during accept returned', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        encryptedWalletPath: './wallet.json',
        dryRun: false,
        maxPriorityFeePerGasScale: 1,
      };

      const errorMessage = 'Transaction failed: insufficient funds';
      acceptReturnedMock.mockRejectedValue(new Error(errorMessage));

      const result = await acceptReturnedDocumentHandler(mockArgs);

      expect(result).toBeUndefined();
      expect(acceptReturnedMock).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions during accept returned', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        encryptedWalletPath: './wallet.json',
        dryRun: false,
        maxPriorityFeePerGasScale: 1,
      };

      acceptReturnedMock.mockRejectedValue('String error message');

      const result = await acceptReturnedDocumentHandler(mockArgs);

      expect(result).toBeUndefined();
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should successfully execute the complete accept returned flow', async () => {
      const mockInputs: any = {
        network: NetworkCmdName.Sepolia,
        tokenRegistryAddress: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
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
        .mockResolvedValueOnce(mockInputs.encryptedWalletPath)
        .mockResolvedValueOnce('');

      const trustvcModule = await import('@trustvc/trustvc');
      const acceptReturnedMock = trustvcModule.acceptReturned as MockedFunction<any>;
      acceptReturnedMock.mockResolvedValue({
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

  describe('acceptReturned', () => {
    beforeEach(() => {
      delete process.env.OA_PRIVATE_KEY;
      vi.mocked(acceptReturnedImpl).mockResolvedValue({
        hash: 'hash',
        wait: () => Promise.resolve({ transactionHash: 'transactionHash' }),
      } as any);
    });

    it('should pass in the correct params and successfully accepts a returned transferable record', async () => {
      const privateKey = '0000000000000000000000000000000000000000000000000000000000000001';
      await acceptReturned({
        ...acceptReturnedDocumentParams,
        key: privateKey,
      });

      expect(acceptReturnedImpl).toHaveBeenCalledTimes(1);
    });
  });
});
