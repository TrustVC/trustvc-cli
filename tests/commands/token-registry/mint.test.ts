import { TransactionReceipt } from '@ethersproject/providers';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { handler, mintToken, promptForInputs } from '../../../src/commands/token-registry/mint';
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
  mint: vi.fn(),
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
  isWrappedV2Document: vi.fn(),
  isWrappedV3Document: vi.fn(),
  verifyOASignature: vi.fn(),
  verifyW3CSignature: vi.fn(),
  deriveW3C: vi.fn(),
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
    extractDocumentInfo: vi.fn(),
    promptAddress: vi.fn(),
    promptWalletSelection: vi.fn(),
    promptRemark: vi.fn(),
    performDryRunWithConfirmation: vi.fn(async () => true), // Mock to always proceed
    verifyDocumentSignature: vi.fn(),
  };
});

vi.mock('../../../src/commands/helpers', () => ({
  connectToTokenRegistry: vi.fn(async () => ({
    mint: {
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

describe('token-registry/mint', () => {
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
        address: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
        remark: 'Test remark',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.address,
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.address,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.beneficiary) // Beneficiary
        .mockResolvedValueOnce(mockInputs.holder); // Holder
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });
      (utils.promptRemark as any).mockResolvedValue(mockInputs.remark);

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);
      expect(result.address).toBe(mockInputs.address);
      expect(result.tokenId).toBe(mockInputs.tokenId);
      expect(result.beneficiary).toBe(mockInputs.beneficiary);
      expect(result.holder).toBe(mockInputs.holder);
      expect((result as any).encryptedWalletPath).toBe('./wallet.json');
      expect(result.remark).toBe(mockInputs.remark);
      expect(result.encryptionKey).toBe(mockInputs.documentId);
      expect(result.maxPriorityFeePerGasScale).toBe(1);
    });

    it('should return correct answers for valid inputs with private key file', async () => {
      const mockInputs = {
        network: NetworkCmdName.Mainnet,
        address: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.address,
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.address,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v4',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.beneficiary)
        .mockResolvedValueOnce(mockInputs.holder);
      (utils.promptWalletSelection as any).mockResolvedValue({
        keyFile: './private-key.txt',
      });
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);
      expect((result as any).keyFile).toBe('./private-key.txt');
      expect(result.remark).toBeUndefined();
      expect(result.encryptionKey).toBe(mockInputs.documentId);
    });

    it('should return correct answers for valid inputs with direct private key', async () => {
      const mockInputs = {
        network: NetworkCmdName.Matic,
        address: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.address,
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.address,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.beneficiary)
        .mockResolvedValueOnce(mockInputs.holder);
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
        address: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.address,
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.address,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.beneficiary)
        .mockResolvedValueOnce(mockInputs.holder);
      (utils.promptWalletSelection as any).mockResolvedValue({});
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const result = await promptForInputs();

      expect(result.network).toBe(mockInputs.network);
      expect((result as any).key).toBeUndefined();
      expect((result as any).keyFile).toBeUndefined();
      expect((result as any).encryptedWalletPath).toBeUndefined();

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
        network: NetworkCmdName.Sepolia,
        address: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.address,
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.address,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.beneficiary)
        .mockResolvedValueOnce(mockInputs.holder);
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

    it('should handle optional remark without encryption key', async () => {
      const mockInputs = {
        network: NetworkCmdName.Sepolia,
        address: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.address,
      };

      const utils = await import('../../../src/utils');
      (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.address,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.beneficiary)
        .mockResolvedValueOnce(mockInputs.holder);
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const result = await promptForInputs();

      expect(result.remark).toBeUndefined();
      expect(result.encryptionKey).toBe(mockInputs.documentId);
    });

    it('should support all network options', async () => {
      const networks = [
        NetworkCmdName.Local,
        NetworkCmdName.Mainnet,
        NetworkCmdName.Sepolia,
        NetworkCmdName.Matic,
        NetworkCmdName.Amoy,
        NetworkCmdName.XDC,
        NetworkCmdName.XDCApothem,
        NetworkCmdName.StabilityTestnet,
        NetworkCmdName.Stability,
        NetworkCmdName.Astron,
        NetworkCmdName.AstronTestnet,
      ];

      for (const network of networks) {
        vi.clearAllMocks();

        const mockInputs = {
          address: '0x1234567890123456789012345678901234567890',
          tokenId: '0xabcdef1234567890',
          beneficiary: '0x0987654321098765432109876543210987654321',
          holder: '0x1111111111111111111111111111111111111111',
          documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
        };

        const mockDocument = {
          id: mockInputs.documentId,
          tokenRegistry: mockInputs.address,
        };

        const utils = await import('../../../src/utils');
        (utils.promptAndReadDocument as any).mockResolvedValue(mockDocument);
        (utils.extractDocumentInfo as any).mockResolvedValue({
          document: mockDocument,
          tokenRegistry: mockInputs.address,
          tokenId: mockInputs.tokenId,
          network: network,
          documentId: mockInputs.documentId,
          registryVersion: 'v5',
        });
        (utils.promptAddress as any)
          .mockResolvedValueOnce(mockInputs.beneficiary)
          .mockResolvedValueOnce(mockInputs.holder);
        (utils.promptWalletSelection as any).mockResolvedValue({
          encryptedWalletPath: './wallet.json',
        });
        (utils.promptRemark as any).mockResolvedValue(undefined);

        const result = await promptForInputs();
        expect(result.network).toBe(network);
      }
    });
  });

  describe('mintToken', () => {
    let mintMock: MockedFunction<any>;
    let getWalletOrSignerMock: MockedFunction<any>;

    beforeEach(async () => {
      vi.clearAllMocks();

      const trustvcModule = await import('@trustvc/trustvc');
      mintMock = trustvcModule.mint as MockedFunction<any>;

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

    it('should successfully mint token and display transaction details', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        address: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
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

      mintMock.mockResolvedValue({
        hash: mockTransaction.transactionHash,
        wait: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await mintToken(mockArgs);

      expect(mintMock).toHaveBeenCalledWith(
        { tokenRegistryAddress: mockArgs.address },
        expect.anything(),
        expect.objectContaining({
          beneficiaryAddress: mockArgs.beneficiary,
          holderAddress: mockArgs.holder,
          tokenId: expect.stringContaining('0x'),
        }),
        expect.anything(),
      );
      expect(result).toBe(mockArgs.address);
    });

    it('should handle minting with remark and encryption key', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Mainnet,
        address: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
        remark: 'Important document',
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
        to: mockArgs.address,
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

      mintMock.mockResolvedValue({
        hash: mockTransaction.transactionHash,
        wait: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await mintToken(mockArgs);

      expect(mintMock).toHaveBeenCalledWith(
        { tokenRegistryAddress: mockArgs.address },
        expect.anything(),
        expect.objectContaining({
          beneficiaryAddress: mockArgs.beneficiary,
          holderAddress: mockArgs.holder,
          tokenId: expect.stringContaining('0x'),
          remarks: mockArgs.remark,
        }),
        expect.objectContaining({
          id: mockArgs.encryptionKey,
        }),
      );
      expect(result).toBe(mockArgs.address);
    });

    it('should handle errors during minting', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        address: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
        encryptedWalletPath: './wallet.json',
        maxPriorityFeePerGasScale: 1,
      };

      const errorMessage = 'Transaction failed: insufficient funds';
      mintMock.mockRejectedValue(new Error(errorMessage));

      const result = await mintToken(mockArgs);

      expect(result).toBeUndefined();
      expect(mintMock).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions during minting', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        address: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
        encryptedWalletPath: './wallet.json',
        maxPriorityFeePerGasScale: 1,
      };

      mintMock.mockRejectedValue('String error message');

      const result = await mintToken(mockArgs);

      expect(result).toBeUndefined();
    });

    it('should call addAddressPrefix for tokenId', async () => {
      const mockArgs: any = {
        network: NetworkCmdName.Sepolia,
        address: '0x1234567890123456789012345678901234567890',
        tokenId: 'abcdef1234567890', // Without 0x prefix
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
        encryptedWalletPath: './wallet.json',
        maxPriorityFeePerGasScale: 1,
      };

      const mockTransaction: TransactionReceipt = {
        transactionHash: '0xtxhash789',
        blockNumber: 12347,
        blockHash: '0xblockhash3',
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

      mintMock.mockResolvedValue({
        hash: mockTransaction.transactionHash,
        wait: vi.fn().mockResolvedValue(mockTransaction),
      });

      const utils = await import('../../../src/utils');
      const addAddressPrefixSpy = utils.addAddressPrefix as MockedFunction<any>;

      await mintToken(mockArgs);

      expect(addAddressPrefixSpy).toHaveBeenCalledWith(mockArgs.tokenId);
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should successfully execute the complete mint flow', async () => {
      const mockInputs: any = {
        network: NetworkCmdName.Sepolia,
        address: '0x1234567890123456789012345678901234567890',
        tokenId: '0xabcdef1234567890',
        beneficiary: '0x0987654321098765432109876543210987654321',
        holder: '0x1111111111111111111111111111111111111111',
        encryptedWalletPath: './wallet.json',
        documentId: 'urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692',
        maxPriorityFeePerGasScale: 1,
      };

      const mockDocument = {
        id: mockInputs.documentId,
        tokenRegistry: mockInputs.address,
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
      (utils.extractDocumentInfo as any).mockResolvedValue({
        document: mockDocument,
        tokenRegistry: mockInputs.address,
        tokenId: mockInputs.tokenId,
        network: mockInputs.network,
        documentId: mockInputs.documentId,
        registryVersion: 'v5',
      });
      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.beneficiary)
        .mockResolvedValueOnce(mockInputs.holder);
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: mockInputs.encryptedWalletPath,
      });
      (utils.promptRemark as any).mockResolvedValue(undefined);

      const trustvcModule = await import('@trustvc/trustvc');
      const mintMock = trustvcModule.mint as MockedFunction<any>;
      mintMock.mockResolvedValue({
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
