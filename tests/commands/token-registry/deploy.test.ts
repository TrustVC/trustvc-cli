import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  handler,
  deployTokenRegistryContract,
  promptForInputs,
} from '../../../src/commands/token-registry/deploy';
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
  deployTokenRegistry: vi.fn(),
  v5Contracts: {
    TitleEscrow__factory: {},
    TradeTrustToken__factory: {},
  },
  v5ContractAddress: {
    TitleEscrowFactory: {
      1: '0xFactoryMainnet',
      11155111: '0xFactorySepolia',
      137: '0xFactoryMatic',
    },
    TokenImplementation: {
      1: '0xTokenImplMainnet',
      11155111: '0xTokenImplSepolia',
      137: '0xTokenImplMatic',
    },
    Deployer: {
      1: '0xDeployerMainnet',
      11155111: '0xDeployerSepolia',
      137: '0xDeployerMatic',
    },
  },
  v5Utils: {
    encodeInitParams: vi.fn(() => '0xencodedparams'),
  },
  checkSupportsInterface: vi.fn(),
  v4SupportInterfaceIds: {},
  v5SupportInterfaceIds: {},
  encrypt: vi.fn(),
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
    getSupportedNetwork: vi.fn((network: string) => ({
      networkId: network === 'sepolia' ? 11155111 : network === 'matic' ? 137 : 1,
    })),
    supportedNetwork: {
      mainnet: { networkId: 1 },
      sepolia: { networkId: 11155111 },
      matic: { networkId: 137 },
    },
    promptNetworkSelection: vi.fn(),
    promptAddress: vi.fn(),
    promptWalletSelection: vi.fn(),
    performDryRunWithConfirmation: vi.fn(async () => true),
  };
});

vi.mock('../../../src/commands/helpers', () => ({
  connectToTDocDeployerContract: vi.fn(async () => ({
    deploy: {
      populateTransaction: vi.fn(),
    },
  })),
  connectToTradeTrustTokenFactory: vi.fn(async () => ({
    getDeployTransaction: vi.fn(),
  })),
  waitForTransaction: vi.fn(),
}));

describe('token-registry/deploy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForInputs', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should return correct answers for standalone deployment with encrypted wallet', async () => {
      const mockInputs = {
        registryName: 'Test Token Registry',
        registrySymbol: 'TTR',
        standalone: true,
        factoryAddress: '0x1234567890123456789012345678901234567890',
        network: NetworkCmdName.Sepolia,
      };

      const utils = await import('../../../src/utils');
      (utils.promptNetworkSelection as any).mockResolvedValue(mockInputs.network);

      const inquirer = await import('@inquirer/prompts');
      (inquirer.input as any)
        .mockResolvedValueOnce(mockInputs.registryName)
        .mockResolvedValueOnce(mockInputs.registrySymbol);
      (inquirer.confirm as any).mockResolvedValue(true);

      (utils.promptAddress as any).mockResolvedValue(mockInputs.factoryAddress);
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });

      const result = await promptForInputs();

      expect(result.registryName).toBe(mockInputs.registryName);
      expect(result.registrySymbol).toBe(mockInputs.registrySymbol);
      expect(result.standalone).toBe(true);
      expect(result.factoryAddress).toBe(mockInputs.factoryAddress);
      expect(result.network).toBe(NetworkCmdName.Sepolia);
      expect(result.maxPriorityFeePerGasScale).toBe(1);
      expect((result as any).encryptedWalletPath).toBe('./wallet.json');
    });

    it('should return correct answers for factory deployment with implementation addresses', async () => {
      const mockInputs = {
        registryName: 'Factory Token Registry',
        registrySymbol: 'FTR',
        standalone: false,
        tokenRegistryImplAddress: '0x1111111111111111111111111111111111111111',
        deployerContractAddress: '0x2222222222222222222222222222222222222222',
        network: NetworkCmdName.Mainnet,
      };

      const utils = await import('../../../src/utils');
      (utils.promptNetworkSelection as any).mockResolvedValue(mockInputs.network);

      const inquirer = await import('@inquirer/prompts');
      (inquirer.input as any)
        .mockResolvedValueOnce(mockInputs.registryName)
        .mockResolvedValueOnce(mockInputs.registrySymbol);
      (inquirer.confirm as any).mockResolvedValue(false);

      (utils.promptAddress as any)
        .mockResolvedValueOnce(mockInputs.tokenRegistryImplAddress)
        .mockResolvedValueOnce(mockInputs.deployerContractAddress);
      (utils.promptWalletSelection as any).mockResolvedValue({
        keyFile: './private-key.txt',
      });

      const result = await promptForInputs();

      expect(result.registryName).toBe(mockInputs.registryName);
      expect(result.registrySymbol).toBe(mockInputs.registrySymbol);
      expect(result.standalone).toBe(false);
      expect(result.tokenRegistryImplAddress).toBe(mockInputs.tokenRegistryImplAddress);
      expect(result.deployerContractAddress).toBe(mockInputs.deployerContractAddress);
      expect((result as any).keyFile).toBe('./private-key.txt');
    });

    it('should return correct answers with direct private key', async () => {
      const mockInputs = {
        registryName: 'Key Token Registry',
        registrySymbol: 'KTR',
        standalone: true,
        network: NetworkCmdName.Matic,
      };

      const utils = await import('../../../src/utils');
      (utils.promptNetworkSelection as any).mockResolvedValue(mockInputs.network);

      const inquirer = await import('@inquirer/prompts');
      (inquirer.input as any)
        .mockResolvedValueOnce(mockInputs.registryName)
        .mockResolvedValueOnce(mockInputs.registrySymbol);
      (inquirer.confirm as any).mockResolvedValue(true);

      (utils.promptAddress as any).mockResolvedValue(undefined);
      (utils.promptWalletSelection as any).mockResolvedValue({
        key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      });

      const result = await promptForInputs();

      expect(result.registryName).toBe(mockInputs.registryName);
      expect((result as any).key).toBe(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      );
    });

    it('should validate registry name is required', async () => {
      const utils = await import('../../../src/utils');
      (utils.promptNetworkSelection as any).mockResolvedValue(NetworkCmdName.Sepolia);

      const inquirer = await import('@inquirer/prompts');
      const inputMock = inquirer.input as any;

      let callCount = 0;
      // Test the validation function
      inputMock.mockImplementation(async ({ validate }: any) => {
        callCount++;
        if (callCount === 1) {
          const validationResult = validate('');
          expect(validationResult).toBe('Registry name is required');
          return 'Valid Name';
        }
        return 'SYMBOL';
      });

      (inquirer.confirm as any).mockResolvedValue(true);
      (utils.promptAddress as any).mockResolvedValue(undefined);
      (utils.promptWalletSelection as any).mockResolvedValue({ key: '0xkey' });

      await promptForInputs();
    });

    it('should validate registry symbol is required', async () => {
      const utils = await import('../../../src/utils');
      (utils.promptNetworkSelection as any).mockResolvedValue(NetworkCmdName.Sepolia);

      const inquirer = await import('@inquirer/prompts');
      const inputMock = inquirer.input as any;

      let callCount = 0;
      inputMock.mockImplementation(async ({ validate }: any) => {
        callCount++;
        if (callCount === 1) {
          return 'Registry Name';
        }
        // Second call is for symbol
        const validationResult = validate('  ');
        expect(validationResult).toBe('Registry symbol is required');
        return 'SYMBOL';
      });

      (inquirer.confirm as any).mockResolvedValue(true);
      (utils.promptAddress as any).mockResolvedValue(undefined);
      (utils.promptWalletSelection as any).mockResolvedValue({ key: '0xkey' });

      await promptForInputs();
    });
  });

  describe('deployTokenRegistryContract', () => {
    let deployTokenRegistryMock: MockedFunction<any>;
    let getWalletOrSignerMock: MockedFunction<any>;
    let waitForTransactionMock: MockedFunction<any>;

    beforeEach(async () => {
      vi.clearAllMocks();

      const trustvcModule = await import('@trustvc/trustvc');
      deployTokenRegistryMock = trustvcModule.deployTokenRegistry as MockedFunction<any>;

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
      (utils.getSupportedNetwork as any).mockImplementation((network: string) => ({
        networkId: network === 'sepolia' ? 11155111 : network === 'matic' ? 137 : 1,
      }));
    });

    it('should successfully deploy standalone token registry', async () => {
      const mockArgs: any = {
        registryName: 'Test Registry',
        registrySymbol: 'TEST',
        standalone: true,
        factoryAddress: '0x1234567890123456789012345678901234567890',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const mockReceipt = {
        hash: '0xtxhash123',
        contractAddress: '0xdeployedcontract',
        blockNumber: 12345,
        gasUsed: BigInt(100000),
        logs: [],
      };

      deployTokenRegistryMock.mockResolvedValue(mockReceipt);

      const result = await deployTokenRegistryContract(mockArgs);

      expect(deployTokenRegistryMock).toHaveBeenCalledWith(
        mockArgs.registryName,
        mockArgs.registrySymbol,
        expect.anything(),
        expect.objectContaining({
          chainId: 11155111,
          standalone: true,
          factoryAddress: mockArgs.factoryAddress,
        }),
      );
      expect(result).toBe(mockReceipt.contractAddress);
    });

    it('should successfully deploy factory-based token registry', async () => {
      const mockArgs: any = {
        registryName: 'Factory Registry',
        registrySymbol: 'FACT',
        standalone: false,
        tokenRegistryImplAddress: '0x1111111111111111111111111111111111111111',
        deployerContractAddress: '0x2222222222222222222222222222222222222222',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const mockTransaction = {
        hash: '0xtxhash456',
        wait: vi.fn().mockResolvedValue({
          hash: '0xtxhash456',
          blockNumber: 12346,
        }),
      };

      const mockReceipt = {
        hash: '0xtxhash456',
        contractAddress: null,
        blockNumber: 12346,
        gasUsed: BigInt(200000),
        logs: [
          {
            address: '0xdeployedviaFactory',
            topics: [],
            data: '0x',
          },
        ],
      };

      deployTokenRegistryMock.mockResolvedValue(mockTransaction);
      waitForTransactionMock.mockResolvedValue(mockReceipt);

      const result = await deployTokenRegistryContract(mockArgs);

      expect(deployTokenRegistryMock).toHaveBeenCalledWith(
        mockArgs.registryName,
        mockArgs.registrySymbol,
        expect.anything(),
        expect.objectContaining({
          chainId: 11155111,
          standalone: false,
          tokenRegistryImplAddress: mockArgs.tokenRegistryImplAddress,
          deployerContractAddress: mockArgs.deployerContractAddress,
        }),
      );
      expect(waitForTransactionMock).toHaveBeenCalled();
      expect(result).toBe('0xdeployedviaFactory');
    });

    it('should use default addresses when not provided', async () => {
      const mockArgs: any = {
        registryName: 'Default Registry',
        registrySymbol: 'DEF',
        standalone: true,
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const mockReceipt = {
        hash: '0xtxhash789',
        contractAddress: '0xdefaultdeployed',
        blockNumber: 12347,
        gasUsed: BigInt(150000),
        logs: [],
      };

      deployTokenRegistryMock.mockResolvedValue(mockReceipt);

      const result = await deployTokenRegistryContract(mockArgs);

      expect(deployTokenRegistryMock).toHaveBeenCalledWith(
        mockArgs.registryName,
        mockArgs.registrySymbol,
        expect.anything(),
        expect.objectContaining({
          factoryAddress: '0xFactorySepolia',
          tokenRegistryImplAddress: '0xTokenImplSepolia',
          deployerContractAddress: '0xDeployerSepolia',
        }),
      );
      expect(result).toBe(mockReceipt.contractAddress);
    });

    it('should handle errors during deployment', async () => {
      const mockArgs: any = {
        registryName: 'Error Registry',
        registrySymbol: 'ERR',
        standalone: true,
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const errorMessage = 'Deployment failed: insufficient funds';
      deployTokenRegistryMock.mockRejectedValue(new Error(errorMessage));

      const result = await deployTokenRegistryContract(mockArgs);

      expect(result).toBeUndefined();
      expect(deployTokenRegistryMock).toHaveBeenCalled();
    });

    it('should handle missing contract address in receipt', async () => {
      const mockArgs: any = {
        registryName: 'No Address Registry',
        registrySymbol: 'NAR',
        standalone: true,
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const mockReceipt = {
        hash: '0xtxhash999',
        contractAddress: null,
        blockNumber: 12348,
        gasUsed: BigInt(100000),
        logs: [],
      };

      deployTokenRegistryMock.mockResolvedValue(mockReceipt);

      const result = await deployTokenRegistryContract(mockArgs);

      expect(result).toBeNull();
    });

    it('should exit when dry run is not confirmed', async () => {
      const mockArgs: any = {
        registryName: 'Cancelled Registry',
        registrySymbol: 'CAN',
        standalone: true,
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const utils = await import('../../../src/utils');
      (utils.performDryRunWithConfirmation as any).mockResolvedValueOnce(false);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

      await deployTokenRegistryContract(mockArgs);

      expect(exitSpy).toHaveBeenCalledWith(0);

      exitSpy.mockRestore();

      // Reset the mock back to true for other tests
      (utils.performDryRunWithConfirmation as any).mockResolvedValue(true);
    });

    it('should handle dry run transaction population for standalone deployment', async () => {
      const mockArgs: any = {
        registryName: 'Dry Run Registry',
        registrySymbol: 'DRY',
        standalone: true,
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const utils = await import('../../../src/utils');
      let capturedCallback: any;
      (utils.performDryRunWithConfirmation as any).mockImplementation(
        async ({ getTransactionCallback }: any) => {
          capturedCallback = getTransactionCallback;
          return true;
        },
      );

      const helpersModule = await import('../../../src/commands/helpers');
      const mockFactory = {
        getDeployTransaction: vi.fn().mockResolvedValue({
          to: '0xfactory',
          data: '0xdata',
        }),
      };
      (helpersModule.connectToTradeTrustTokenFactory as any).mockResolvedValue(mockFactory);

      const mockReceipt = {
        hash: '0xtxhash',
        contractAddress: '0xdeployed',
        logs: [],
      };
      deployTokenRegistryMock.mockResolvedValue(mockReceipt);

      await deployTokenRegistryContract(mockArgs);

      expect(capturedCallback).toBeDefined();
      if (capturedCallback) {
        const tx = await capturedCallback();
        expect(tx.from).toBe('0xsigner');
      }
    });

    it('should handle dry run transaction population for factory deployment', async () => {
      const mockArgs: any = {
        registryName: 'Factory Dry Run',
        registrySymbol: 'FDR',
        standalone: false,
        tokenRegistryImplAddress: '0x1111111111111111111111111111111111111111',
        deployerContractAddress: '0x2222222222222222222222222222222222222222',
        network: NetworkCmdName.Sepolia,
        maxPriorityFeePerGasScale: 1,
      };

      const utils = await import('../../../src/utils');
      let capturedCallback: any;
      (utils.performDryRunWithConfirmation as any).mockImplementation(
        async ({ getTransactionCallback }: any) => {
          capturedCallback = getTransactionCallback;
          return true;
        },
      );

      const helpersModule = await import('../../../src/commands/helpers');
      const mockDeployer = {
        deploy: {
          populateTransaction: vi.fn().mockResolvedValue({
            to: '0xdeployer',
            data: '0xdata',
          }),
        },
      };
      (helpersModule.connectToTDocDeployerContract as any).mockResolvedValue(mockDeployer);

      const mockTransaction = { hash: '0xtx' };
      const mockReceipt = {
        hash: '0xtx',
        contractAddress: null,
        logs: [{ address: '0xdeployed' }],
      };
      deployTokenRegistryMock.mockResolvedValue(mockTransaction);
      waitForTransactionMock.mockResolvedValue(mockReceipt);

      await deployTokenRegistryContract(mockArgs);

      expect(capturedCallback).toBeDefined();
      if (capturedCallback) {
        const tx = await capturedCallback();
        expect(tx.from).toBe('0xsigner');
      }
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetAllMocks();
    });

    it('should successfully execute the complete deployment flow', async () => {
      const mockInputs: any = {
        network: NetworkCmdName.Sepolia,
        registryName: 'Handler Registry',
        registrySymbol: 'HDL',
        standalone: true,
        factoryAddress: '0x1234567890123456789012345678901234567890',
        encryptedWalletPath: './wallet.json',
        maxPriorityFeePerGasScale: 1,
      };

      const utils = await import('../../../src/utils');
      (utils.promptNetworkSelection as any).mockResolvedValue(mockInputs.network);

      const inquirer = await import('@inquirer/prompts');
      (inquirer.input as any)
        .mockResolvedValueOnce(mockInputs.registryName)
        .mockResolvedValueOnce(mockInputs.registrySymbol);
      (inquirer.confirm as any).mockResolvedValue(true);

      (utils.promptAddress as any).mockResolvedValue(mockInputs.factoryAddress);
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: mockInputs.encryptedWalletPath,
      });

      const trustvcModule = await import('@trustvc/trustvc');
      const deployMock = trustvcModule.deployTokenRegistry as MockedFunction<any>;
      deployMock.mockResolvedValue({
        hash: '0xtxhash',
        contractAddress: '0xdeployed',
        logs: [],
      });

      const walletModule = await import('../../../src/utils/wallet');
      const getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;
      getWalletOrSignerMock.mockResolvedValue({
        provider: {},
        getAddress: vi.fn().mockResolvedValue('0xsigner'),
      });

      const result = await handler();

      expect(result).toBeUndefined();
    });

    it('should handle errors in handler', async () => {
      const errorMessage = 'Network selection error';
      const utils = await import('../../../src/utils');
      (utils.promptNetworkSelection as any).mockRejectedValue(new Error(errorMessage));

      await handler();

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith(errorMessage);
    });

    it('should handle non-Error exceptions in handler', async () => {
      const errorMessage = 'String error';
      const utils = await import('../../../src/utils');
      (utils.promptNetworkSelection as any).mockRejectedValue(errorMessage);

      await handler();

      const signaleModule = await import('signale');
      expect(signaleModule.error).toHaveBeenCalledWith(errorMessage);
    });

    it('should return early if promptForInputs returns falsy value', async () => {
      const utils = await import('../../../src/utils');
      (utils.promptNetworkSelection as any).mockResolvedValue(null);

      const trustvcModule = await import('@trustvc/trustvc');
      const deployMock = trustvcModule.deployTokenRegistry as MockedFunction<any>;

      await handler();

      expect(deployMock).not.toHaveBeenCalled();
    });
  });
});
