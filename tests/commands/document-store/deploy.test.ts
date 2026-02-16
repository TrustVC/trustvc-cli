// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules first to avoid hoisting issues
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

vi.mock('@trustvc/trustvc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@trustvc/trustvc')>();
  return {
    ...actual,
    deployDocumentStore: vi.fn(),
    CHAIN_ID: {
      mainnet: 1,
      sepolia: 11155111,
    },
    SUPPORTED_CHAINS: {
      11155111: {
        name: 'sepolia',
        chain: 'ETH',
        network: 'sepolia',
        rpc: ['https://sepolia.infura.io/v3/'],
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'SEP', decimals: 18 },
        infoURL: 'https://sepolia.etherscan.io',
      },
    },
  };
});

vi.mock('../../../src/utils', () => ({
  NetworkCmdName: {
    Sepolia: 'sepolia',
  },
  getWalletOrSigner: vi.fn().mockResolvedValue({
    provider: {},
    getAddress: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
  }),
  getErrorMessage: (e: any) => e?.message || String(e),
  getEtherscanAddress: () => 'https://etherscan.io',
  getSupportedNetwork: () => ({
    networkId: 11155111,
    explorerUrl: 'https://sepolia.etherscan.io',
    rpcUrl: 'https://sepolia.infura.io/v3/test',
  }),
  displayTransactionPrice: vi.fn(),
  promptNetworkSelection: vi.fn().mockResolvedValue('sepolia'),
  promptWalletSelection: vi.fn().mockResolvedValue({
    encryptedWalletPath: './wallet.json',
  }),
  performDryRunWithConfirmation: vi.fn().mockResolvedValue(true),
  addAddressPrefix: (address: string) => `0x${address}`,
}));

vi.mock('@inquirer/prompts', () => ({
  input: vi
    .fn()
    .mockResolvedValueOnce('Test Document Store')
    .mockResolvedValueOnce('0x1234567890123456789012345678901234567890'),
}));

// Now import the module under test
import {
  handler,
  promptForInputs,
  deployDocumentStoreContract,
} from '../../../src/commands/document-store/deploy';
import { getWalletOrSigner } from '../../../src/utils';

describe('document-store/deploy', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('promptForInputs', () => {
    it('should return correct inputs', async () => {
      const result = await promptForInputs();

      expect(result).toEqual({
        network: 'sepolia',
        storeName: 'Test Document Store',
        owner: '0x1234567890123456789012345678901234567890',
        encryptedWalletPath: './wallet.json',
        maxPriorityFeePerGasScale: 1,
      });
    });
  });

  describe('deployDocumentStoreContract', () => {
    it('should deploy a document store successfully', async () => {
      const trustvc = await import('@trustvc/trustvc');
      const mockTx = {
        contractAddress: '0x123contract_address',
        transactionHash: '0x123tx',
        blockNumber: 1234567,
        status: 1,
      };
      trustvc.deployDocumentStore = vi.fn().mockResolvedValue(mockTx);

      const result = await deployDocumentStoreContract({
        network: 'sepolia',
        storeName: 'Test Store',
        owner: '0x123',
        encryptedWalletPath: './wallet.json',
        maxPriorityFeePerGasScale: 1,
      });

      expect(trustvc.deployDocumentStore).toHaveBeenCalledWith(
        'Test Store',
        '0x123',
        await getWalletOrSigner({ network: 'sepolia' }),
        { chainId: 11155111 },
      );
      expect(result).toBe('0x123contract_address');
    });
  });

  describe('handler', () => {
    it('should handle successful deployment', async () => {
      const trustvc = await import('@trustvc/trustvc');
      const mockTx = {
        wait: vi.fn().mockResolvedValue({
          transactionHash: '0x123',
          blockNumber: 1234567,
          status: 1,
        }),
      };
      trustvc.deployDocumentStore = vi.fn().mockResolvedValue(mockTx);

      await handler();

      const signale = await import('signale');
      expect(signale.success).toHaveBeenCalled();
    });
  });
});
