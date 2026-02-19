import { TransactionReceipt } from '@ethersproject/providers';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { handler, revokeToken, promptForInputs } from '../../../src/commands/document-store/revoke';
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
  documentStoreRevoke: vi.fn(),
  v5Contracts: {
    TitleEscrow__factory: {},
    TradeTrustToken__factory: {},
  },
  checkSupportsInterface: vi.fn(),
  v4SupportInterfaceIds: {},
  v5SupportInterfaceIds: {},
  encrypt: vi.fn(),
  getTokenRegistryAddress: vi.fn(),
  getTokenId: vi.fn(),
  getChainId: vi.fn(),
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
    80002: {
      name: 'amoy',
      explorerUrl: 'https://www.oklink.com/amoy',
      rpcUrl: 'https://rpc-amoy.polygon.technology',
      nativeCurrency: { symbol: 'MATIC', decimals: 18 },
    },
    50: {
      name: 'xdc',
      explorerUrl: 'https://xdcscan.io',
      rpcUrl: 'https://rpc.ankr.com/xdc',
      nativeCurrency: { symbol: 'XDC', decimals: 18 },
    },
    51: {
      name: 'xdcapothem',
      explorerUrl: 'https://apothem.xdcscan.io',
      rpcUrl: 'https://rpc.apothem.network',
      nativeCurrency: { symbol: 'XDC', decimals: 18 },
    },
    101010: {
      name: 'stability',
      explorerUrl: 'https://stability.blockscout.com',
      rpcUrl: 'https://rpc.stabilityprotocol.com/zgt/tradeTrust',
      nativeCurrency: { symbol: 'FREE', decimals: 18 },
    },
    20180427: {
      name: 'stabilitytestnet',
      explorerUrl: 'https://stability-testnet.blockscout.com/',
      rpcUrl: 'https://rpc.testnet.stabilityprotocol.com/zgt/tradeTrust',
      nativeCurrency: { symbol: 'FREE', decimals: 18 },
    },
    1338: {
      name: 'astron',
      explorerUrl: 'https://astronscanl2.bitfactory.cn/',
      rpcUrl: 'https://astronlayer2.bitfactory.cn/query/',
      nativeCurrency: { symbol: 'ASTRON', decimals: 18 },
    },
    21002: {
      name: 'astrontestnet',
      explorerUrl: 'https://dev-astronscanl2.bitfactory.cn/',
      rpcUrl: 'https://dev-astronlayer2.bitfactory.cn/query/',
      nativeCurrency: { symbol: 'ASTRON', decimals: 18 },
    },
  },
  CHAIN_ID: {
    mainnet: 1,
    sepolia: 11155111,
    matic: 137,
    amoy: 80002,
    xdc: 50,
    xdcapothem: 51,
    stability: 101010,
    stabilitytestnet: 20180427,
    astron: 1338,
    astrontestnet: 21002,
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
    addAddressPrefix: vi.fn((address?: string) => {
      if (!address) return '0x';
      return address.startsWith('0x') ? address : `0x${address}`;
    }),
    displayTransactionPrice: vi.fn(),
    canEstimateGasPrice: vi.fn(() => false),
    getGasFees: vi.fn(),
    promptAndReadDocument: vi.fn(),
    extractOADocumentInfo: vi.fn(),
    promptAddress: vi.fn(),
    promptWalletSelection: vi.fn(),
    promptRemark: vi.fn(),
    performDryRunWithConfirmation: vi.fn(async () => true), // Mock to always proceed
  };
});

vi.mock('../../../src/commands/helpers', () => ({
  connectToDocumentStore: vi.fn(async () => ({
    revoke: {
      populateTransaction: vi.fn(),
    },
  })),
  connectToTitleEscrow: vi.fn(),
  validateEndorseChangeOwner: vi.fn(),
  validateNominateBeneficiary: vi.fn(),
  validatePreviousBeneficiary: vi.fn(),
  validatePreviousHolder: vi.fn(),
  validateEndorseTransferOwner: vi.fn(),
  validateAndEncryptRemark: vi.fn((remark?: string) => (remark ? `0x${remark}` : '0x')),
  getTokenRegistryVersion: vi.fn(),
}));

describe('document-store/revoke', () => {
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
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        documentHash: 'abcdef1234567890',
      };

      const mockDocument = {
        data: {
          issuers: [
            {
              revocation: {
                location: mockInputs.documentStoreAddress,
              },
            },
          ],
          network: {
            chain: 'e16efdf2-ddf5-446e-bb12-537974796a3c:string:FREE',
            chainId: '3f398602-7c90-45d1-91fb-c717c27a937f:string:101010',
          },
        },
        signature: {
          targetHash: mockInputs.documentHash,
        },
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractOADocumentInfo as any).mockResolvedValue({
        documentStoreAddress: mockInputs.documentStoreAddress,
        tokenId: '0x' + mockInputs.documentHash,
        network: 'FREE',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.documentStoreAddress) // Beneficiary
        .mockResolvedValueOnce('0x' + mockInputs.documentHash); // Holder
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });

      const result = await promptForInputs();

      expect(result.documentStoreAddress).toBe(mockInputs.documentStoreAddress);
      expect(result.documentHash).toBe('0x' + mockInputs.documentHash);
      expect(result.maxPriorityFeePerGasScale).toBe(1);
    });

    it('should return correct answers for valid inputs with private key file', async () => {
      const mockInputs = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        documentHash: 'abcdef1234567890',
      };

      const mockDocument = {
        data: {
          issuers: [
            {
              revocation: {
                location: mockInputs.documentStoreAddress,
              },
            },
          ],
          network: {
            chain: 'e16efdf2-ddf5-446e-bb12-537974796a3c:string:FREE',
            chainId: '3f398602-7c90-45d1-91fb-c717c27a937f:string:101010',
          },
        },
        signature: {
          targetHash: mockInputs.documentHash,
        },
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractOADocumentInfo as any).mockResolvedValue({
        documentStoreAddress: mockInputs.documentStoreAddress,
        tokenId: '0x' + mockInputs.documentHash,
        network: 'FREE',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.documentStoreAddress)
        .mockResolvedValueOnce('0x' + mockInputs.documentHash);
      (utils.promptWalletSelection as any).mockResolvedValue({
        keyFile: './private-key.txt',
      });
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const result = await promptForInputs();

      expect(result.documentStoreAddress).toBe(mockInputs.documentStoreAddress);
      expect(result.documentHash).toBe('0x' + mockInputs.documentHash);
      expect(result.maxPriorityFeePerGasScale).toBe(1);
    });

    it('should return correct answers for valid inputs with direct private key', async () => {
      const mockInputs = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        documentHash: 'abcdef1234567890',
      };

      const mockDocument = {
        data: {
          issuers: [
            {
              revocation: {
                location: mockInputs.documentStoreAddress,
              },
            },
          ],
          network: {
            chain: 'e16efdf2-ddf5-446e-bb12-537974796a3c:string:FREE',
            chainId: '3f398602-7c90-45d1-91fb-c717c27a937f:string:101010',
          },
        },
        signature: {
          targetHash: mockInputs.documentHash,
        },
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractOADocumentInfo as any).mockResolvedValue({
        documentStoreAddress: mockInputs.documentStoreAddress,
        tokenId: '0x' + mockInputs.documentHash,
        network: 'FREE',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.documentStoreAddress)
        .mockResolvedValueOnce('0x' + mockInputs.documentHash);
      (utils.promptWalletSelection as any).mockResolvedValue({
        key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      });
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const result = await promptForInputs();

      expect(result.documentStoreAddress).toBe(mockInputs.documentStoreAddress);
      expect(result.documentHash).toBe('0x' + mockInputs.documentHash);
      expect(result.maxPriorityFeePerGasScale).toBe(1);
    });

    it('should return correct answers when using environment variable for private key', async () => {
      const originalEnv = process.env.OA_PRIVATE_KEY;
      process.env.OA_PRIVATE_KEY =
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

      const mockInputs = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        documentHash: '0xabcdef1234567890',
      };

      const mockDocument = {
        id: mockInputs.documentStoreAddress,
        tokenRegistry: mockInputs.documentHash,
        data: {
          issuers: [
            {
              revocation: {
                location: mockInputs.documentStoreAddress,
              },
            },
          ],
          network: {
            chain: 'e16efdf2-ddf5-446e-bb12-537974796a3c:string:FREE',
            chainId: '3f398602-7c90-45d1-91fb-c717c27a937f:string:101010',
          },
        },
        signature: {
          targetHash: mockInputs.documentHash,
        },
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractOADocumentInfo as any).mockResolvedValue({
        documentStoreAddress: mockInputs.documentStoreAddress,
        tokenId: '0x' + mockInputs.documentHash,
        network: 'FREE',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.documentStoreAddress)
        .mockResolvedValueOnce('0x' + mockInputs.documentHash);
      (utils.promptWalletSelection as any).mockResolvedValue({});
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const result = await promptForInputs();

      expect(result.documentStoreAddress).toBe(mockInputs.documentStoreAddress);
      expect(result.documentHash).toBe('0x' + mockInputs.documentHash);
      expect(result.maxPriorityFeePerGasScale).toBe(1);

      // Restore original env
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
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        documentHash: '0xabcdef1234567890',
      };

      const mockDocument = {
        data: {
          issuers: [
            {
              revocation: {
                location: mockInputs.documentStoreAddress,
              },
            },
          ],
          network: {
            chain: 'e16efdf2-ddf5-446e-bb12-537974796a3c:string:FREE',
            chainId: '3f398602-7c90-45d1-91fb-c717c27a937f:string:101010',
          },
        },
        signature: {
          targetHash: mockInputs.documentHash,
        },
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractOADocumentInfo as any).mockResolvedValue({
        documentStoreAddress: mockInputs.documentStoreAddress,
        tokenId: '0x' + mockInputs.documentHash,
        network: 'FREE',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.documentStoreAddress)
        .mockResolvedValueOnce('0x' + mockInputs.documentHash);
      (utils.promptWalletSelection as any).mockRejectedValue(
        new Error(
          'OA_PRIVATE_KEY environment variable is not set. Please set it or choose another option.',
        ),
      );

      await expect(promptForInputs()).rejects.toThrowError(
        'OA_PRIVATE_KEY environment variable is not set. Please set it or choose another option.',
      );

      // Restore original env
      if (originalEnv) {
        process.env.OA_PRIVATE_KEY = originalEnv;
      }
    });

    it('should validate document file path', async () => {
      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockRejectedValue(
        new Error('Failed to read document file: File does not exist'),
      );

      await expect(promptForInputs()).rejects.toThrowError(
        'Failed to read document file: File does not exist',
      );
    });

    it('should support all network options', async () => {
      const networks = [
        { name: NetworkCmdName.Mainnet, chainId: 1 },
        { name: NetworkCmdName.Sepolia, chainId: 11155111 },
        { name: NetworkCmdName.Matic, chainId: 137 },
        { name: NetworkCmdName.Amoy, chainId: 80002 },
        { name: NetworkCmdName.XDC, chainId: 50 },
        { name: NetworkCmdName.XDCApothem, chainId: 51 },
        { name: NetworkCmdName.StabilityTestnet, chainId: 20180427 },
        { name: NetworkCmdName.Stability, chainId: 101010 },
        { name: NetworkCmdName.Astron, chainId: 1338 },
        { name: NetworkCmdName.AstronTestnet, chainId: 21002 },
      ];

      for (const network of networks) {
        vi.clearAllMocks();

        const mockInputs = {
          documentStoreAddress: '0x1234567890123456789012345678901234567890',
          documentHash: '0xabcdef1234567890',
        };

        const mockDocument = {
          data: {
            issuers: [
              {
                revocation: {
                  location: mockInputs.documentStoreAddress,
                },
              },
            ],
            network: {
              chain: `e16efdf2-ddf5-446e-bb12-537974796a3c:string:${network.name}`,
              chainId: `3f398602-7c90-45d1-91fb-c717c27a937f:string:${network.chainId}`,
            },
          },
          signature: {
            targetHash: mockInputs.documentHash,
          },
        };

        const utils = await import('../../../src/utils');
        (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
        (utils.extractOADocumentInfo as any).mockResolvedValue({
          documentStoreAddress: mockInputs.documentStoreAddress,
          tokenId: mockInputs.documentHash,
          network: network.name,
        });
        (utils.promptAddress as any)
          .mockResolvedValueOnce(mockInputs.documentStoreAddress)
          .mockResolvedValueOnce(mockInputs.documentHash);
        (utils.promptWalletSelection as any).mockResolvedValue({
          encryptedWalletPath: './wallet.json',
        });
        (utils.promptRemark as any).mockResolvedValue(undefined);

        const result = await promptForInputs();
        expect(result.network).toBe(network.name);
      }
    });
  });

  describe('revokeToken', () => {
    let documentStoreRevokeMock: MockedFunction<any>;
    let getWalletOrSignerMock: MockedFunction<any>;

    beforeEach(async () => {
      vi.clearAllMocks();

      const trustvcModule = await import('@trustvc/trustvc');
      documentStoreRevokeMock = trustvcModule.documentStoreRevoke as MockedFunction<any>;

      const walletModule = await import('../../../src/utils/wallet');
      getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;

      // Setup wallet mock
      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
      });

      // Re-setup the addAddressPrefix mock after clearing
      const utils = await import('../../../src/utils');
      (utils.addAddressPrefix as any).mockImplementation((address?: string) => {
        if (!address) return '0x';
        return address.startsWith('0x') ? address : `0x${address}`;
      });

      // Re-setup performDryRunWithConfirmation to always return true (proceed)
      (utils.performDryRunWithConfirmation as any).mockResolvedValue(true);
    });

    it('should successfully revoke token and display transaction details', async () => {
      const mockArgs: any = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        documentHash: '0xabcdef1234567890',
        encryptedWalletPath: './wallet.json',
        maxPriorityFeePerGasScale: 1,
      };

      const mockTransaction: TransactionReceipt = {
        transactionHash: '0xtxhash123',
        blockNumber: 12345,
        blockHash: '0xblockhash',
        confirmations: 1,
        from: '0xfrom',
        to: mockArgs.address,
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

      documentStoreRevokeMock.mockResolvedValue({
        hash: mockTransaction.transactionHash,
        wait: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await documentStoreRevokeMock(mockArgs);

      expect(documentStoreRevokeMock).toHaveBeenCalledWith({
        documentStoreAddress: mockArgs.documentStoreAddress,
        documentHash: mockArgs.documentHash,
        encryptedWalletPath: mockArgs.encryptedWalletPath,
        maxPriorityFeePerGasScale: mockArgs.maxPriorityFeePerGasScale,
      });
      expect(result.hash).toBe(mockTransaction.transactionHash);
    });

    it('should handle errors during revoke', async () => {
      const mockArgs: any = {
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        documentHash: '0xabcdef1234567890',
        encryptedWalletPath: './wallet.json',
        maxPriorityFeePerGasScale: 1,
      };

      const errorMessage = 'Transaction failed: insufficient funds';
      documentStoreRevokeMock.mockRejectedValue(new Error(errorMessage));

      const result = await revokeToken(mockArgs);

      expect(result).toBeUndefined();
      expect(documentStoreRevokeMock).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should successfully execute the complete revoke flow', async () => {
      const mockInputs: any = {
        network: NetworkCmdName.Sepolia,
        documentStoreAddress: '0x1234567890123456789012345678901234567890',
        documentHash: '0xabcdef1234567890',
        encryptedWalletPath: './wallet.json',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
        maxPriorityFeePerGasScale: 1,
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.documentStoreAddress,
      };

      const mockTransaction: TransactionReceipt = {
        transactionHash: '0xtxhash',
        blockNumber: 12345,
        blockHash: '0xblockhash',
        confirmations: 1,
        from: '0xfrom',
        to: mockInputs.address,
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
      (utils.extractOADocumentInfo as any).mockResolvedValue({
        documentStoreAddress: mockInputs.documentStoreAddress,
        tokenId: mockInputs.documentHash,
        network: mockInputs.network,
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.beneficiary)
        .mockResolvedValueOnce(mockInputs.holder);
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: mockInputs.encryptedWalletPath,
      });
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const trustvcModule = await import('@trustvc/trustvc');
      const revokeMock = trustvcModule.documentStoreRevoke as MockedFunction<any>;
      revokeMock.mockResolvedValue({
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
});
