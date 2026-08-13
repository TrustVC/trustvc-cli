import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import { id } from 'ethers';
import {
  promptForDeployPlatformPaymasterInputs,
  runDeployPlatformPaymaster,
  handler,
} from '../../../../src/commands/gasless/deploy/deploy-platform-paymaster';

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
    deployPlatformPaymaster: vi.fn(),
  };
});

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
}));

vi.mock('../../../../src/utils/wallet', () => ({
  getWalletOrSigner: vi.fn(),
}));

vi.mock('../../../../src/utils', async (importOriginal) => {
  const originalUtils = await importOriginal<typeof import('../../../../src/utils')>();
  return {
    ...originalUtils,
    getErrorMessage: vi.fn((e: any) => (e instanceof Error ? e.message : String(e))),
    getEtherscanAddress: vi.fn(() => 'https://sepolia.etherscan.io'),
    getSupportedNetwork: vi.fn(() => ({ networkId: 11155111 })),
    promptAddress: vi.fn(),
    promptNetworkSelection: vi.fn(),
    promptWalletSelection: vi.fn(),
  };
});

vi.mock('../../../../src/commands/gasless/config', () => ({
  assertGaslessSupportedNetwork: vi.fn((network: string) => network),
  getGaslessFactoryAddress: vi.fn(() => '0xfactoryfactoryfactoryfactoryfactoryfacto'),
}));

const VALID_SALT = `0x${'11'.repeat(32)}`;

describe('gasless/deploy/deploy-platform-paymaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForDeployPlatformPaymasterInputs', () => {
    it('returns the correct shape for a valid 0x-prefixed salt, keeping it as-is', async () => {
      const utils = await import('../../../../src/utils');
      const prompts = await import('@inquirer/prompts');

      (utils.promptNetworkSelection as any).mockResolvedValue('sepolia');
      (utils.promptAddress as any).mockResolvedValue('0x1234567890123456789012345678901234567890');
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });
      (prompts.input as any).mockResolvedValueOnce(VALID_SALT).mockResolvedValueOnce('1000');

      const result = await promptForDeployPlatformPaymasterInputs();

      expect(result.network).toBe('sepolia');
      expect(result.salt).toBe(VALID_SALT);
      expect(result.platformAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(result.dailyLimit).toBe('1000');
      expect((result as any).encryptedWalletPath).toBe('./wallet.json');
    });

    it('hashes a non-0x-prefixed salt into a bytes32 value distinct from the raw input', async () => {
      const utils = await import('../../../../src/utils');
      const prompts = await import('@inquirer/prompts');

      (utils.promptNetworkSelection as any).mockResolvedValue('sepolia');
      (utils.promptAddress as any).mockResolvedValue(undefined);
      (utils.promptWalletSelection as any).mockResolvedValue({});
      (prompts.input as any).mockResolvedValueOnce('my-plain-salt').mockResolvedValueOnce('');

      const result = await promptForDeployPlatformPaymasterInputs();

      expect(result.salt).not.toBe('my-plain-salt');
      expect(result.salt).toBe(id('my-plain-salt'));
      expect(/^0x[a-fA-F0-9]{64}$/.test(result.salt)).toBe(true);
    });

    it('maps an empty daily limit input to undefined', async () => {
      const utils = await import('../../../../src/utils');
      const prompts = await import('@inquirer/prompts');

      (utils.promptNetworkSelection as any).mockResolvedValue('sepolia');
      (utils.promptAddress as any).mockResolvedValue(undefined);
      (utils.promptWalletSelection as any).mockResolvedValue({});
      (prompts.input as any).mockResolvedValueOnce(VALID_SALT).mockResolvedValueOnce('');

      const result = await promptForDeployPlatformPaymasterInputs();

      expect(result.dailyLimit).toBeUndefined();
    });

    it('keeps a "0" daily limit input as the string "0" (non-empty strings are truthy)', async () => {
      const utils = await import('../../../../src/utils');
      const prompts = await import('@inquirer/prompts');

      (utils.promptNetworkSelection as any).mockResolvedValue('sepolia');
      (utils.promptAddress as any).mockResolvedValue(undefined);
      (utils.promptWalletSelection as any).mockResolvedValue({});
      (prompts.input as any).mockResolvedValueOnce(VALID_SALT).mockResolvedValueOnce('0');

      const result = await promptForDeployPlatformPaymasterInputs();

      expect(result.dailyLimit).toBe('0');
    });

    describe('salt input validate', () => {
      const getSaltValidate = async () => {
        const utils = await import('../../../../src/utils');
        const prompts = await import('@inquirer/prompts');

        (utils.promptNetworkSelection as any).mockResolvedValue('sepolia');
        (utils.promptAddress as any).mockResolvedValue(undefined);
        (utils.promptWalletSelection as any).mockResolvedValue({});
        (prompts.input as any).mockResolvedValueOnce(VALID_SALT).mockResolvedValueOnce('');

        await promptForDeployPlatformPaymasterInputs();

        return (prompts.input as MockedFunction<any>).mock.calls[0][0].validate;
      };

      it('rejects a 0x-prefixed salt that is not exactly 64 hex characters', async () => {
        const validate = await getSaltValidate();
        expect(validate('0x1234')).toBe(
          'A 0x-prefixed salt must be a 32-byte (64 hex character) value',
        );
      });

      it('accepts a valid 0x-prefixed 64-hex-character salt', async () => {
        const validate = await getSaltValidate();
        expect(validate(VALID_SALT)).toBe(true);
      });

      it('accepts a non-0x-prefixed value as-is (hashed later, not at the prompt layer)', async () => {
        const validate = await getSaltValidate();
        expect(validate('anything-goes-here')).toBe(true);
      });
    });

    describe('daily limit input validate', () => {
      const getDailyLimitValidate = async () => {
        const utils = await import('../../../../src/utils');
        const prompts = await import('@inquirer/prompts');

        (utils.promptNetworkSelection as any).mockResolvedValue('sepolia');
        (utils.promptAddress as any).mockResolvedValue(undefined);
        (utils.promptWalletSelection as any).mockResolvedValue({});
        (prompts.input as any).mockResolvedValueOnce(VALID_SALT).mockResolvedValueOnce('');

        await promptForDeployPlatformPaymasterInputs();

        return (prompts.input as MockedFunction<any>).mock.calls[1][0].validate;
      };

      it('rejects a non-digit string', async () => {
        const validate = await getDailyLimitValidate();
        expect(validate('abc')).toBe('Daily limit must be a non-negative integer (wei)');
      });

      it('accepts a digit string', async () => {
        const validate = await getDailyLimitValidate();
        expect(validate('12345')).toBe(true);
      });

      it('accepts an empty string', async () => {
        const validate = await getDailyLimitValidate();
        expect(validate('')).toBe(true);
      });
    });
  });

  describe('runDeployPlatformPaymaster', () => {
    let deployPlatformPaymasterMock: MockedFunction<any>;
    let getWalletOrSignerMock: MockedFunction<any>;
    let assertGaslessSupportedNetworkMock: MockedFunction<any>;

    beforeEach(async () => {
      vi.clearAllMocks();

      const trustvcModule = await import('@trustvc/trustvc');
      deployPlatformPaymasterMock = trustvcModule.deployPlatformPaymaster as MockedFunction<any>;

      const walletModule = await import('../../../../src/utils/wallet');
      getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;
      getWalletOrSignerMock.mockResolvedValue({ getAddress: vi.fn().mockResolvedValue('0xfrom') });

      const configModule = await import('../../../../src/commands/gasless/config');
      assertGaslessSupportedNetworkMock =
        configModule.assertGaslessSupportedNetwork as MockedFunction<any>;
      assertGaslessSupportedNetworkMock.mockImplementation((network: string) => network);
      (configModule.getGaslessFactoryAddress as MockedFunction<any>).mockReturnValue(
        '0xfactoryfactoryfactoryfactoryfactoryfacto',
      );

      const utils = await import('../../../../src/utils');
      (utils.getSupportedNetwork as MockedFunction<any>).mockReturnValue({ networkId: 11155111 });
      (utils.getEtherscanAddress as MockedFunction<any>).mockReturnValue(
        'https://sepolia.etherscan.io',
      );
      (utils.getErrorMessage as MockedFunction<any>).mockImplementation((e: any) =>
        e instanceof Error ? e.message : String(e),
      );
    });

    const baseArgs = {
      network: 'sepolia',
      salt: VALID_SALT,
      platformAddress: '0x1234567890123456789012345678901234567890',
      dailyLimit: undefined,
      encryptedWalletPath: './wallet.json',
    };

    it('deploys the paymaster with the correct arguments and returns the deployed address', async () => {
      deployPlatformPaymasterMock.mockResolvedValue({
        txHash: '0xtxhash',
        paymasterAddress: '0xpaymasteraddresspaymasteraddresspaymast',
      });

      const result = await runDeployPlatformPaymaster({
        ...baseArgs,
        dailyLimit: '500',
      });

      expect(deployPlatformPaymasterMock).toHaveBeenCalledWith(expect.anything(), {
        chainId: 11155111,
        salt: VALID_SALT,
        platformAddress: baseArgs.platformAddress,
        factoryAddress: '0xfactoryfactoryfactoryfactoryfactoryfacto',
        dailyLimit: 500n,
      });
      expect(result).toBe('0xpaymasteraddresspaymasteraddresspaymast');
    });

    it('passes dailyLimit as undefined when not provided', async () => {
      deployPlatformPaymasterMock.mockResolvedValue({
        txHash: '0xtxhash',
        paymasterAddress: '0xpaymasteraddresspaymasteraddresspaymast',
      });

      await runDeployPlatformPaymaster(baseArgs);

      expect(deployPlatformPaymasterMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ dailyLimit: undefined }),
      );
    });

    it('returns undefined and logs the error when the network is unsupported', async () => {
      assertGaslessSupportedNetworkMock.mockImplementation(() => {
        throw new Error('Gasless transactions are only supported on: sepolia, amoy.');
      });

      const result = await runDeployPlatformPaymaster(baseArgs);

      const signaleModule = await import('signale');
      expect(result).toBeUndefined();
      expect(signaleModule.error).toHaveBeenCalledWith(
        'Gasless transactions are only supported on: sepolia, amoy.',
      );
      expect(deployPlatformPaymasterMock).not.toHaveBeenCalled();
    });

    it('returns undefined and logs the error when deployPlatformPaymaster rejects with an Error', async () => {
      deployPlatformPaymasterMock.mockRejectedValue(new Error('deployment reverted'));

      const result = await runDeployPlatformPaymaster(baseArgs);

      const signaleModule = await import('signale');
      expect(result).toBeUndefined();
      expect(signaleModule.error).toHaveBeenCalledWith('deployment reverted');
    });

    it('returns undefined and logs the error when deployPlatformPaymaster rejects with a non-Error', async () => {
      deployPlatformPaymasterMock.mockRejectedValue('some string failure');

      const result = await runDeployPlatformPaymaster(baseArgs);

      const signaleModule = await import('signale');
      expect(result).toBeUndefined();
      expect(signaleModule.error).toHaveBeenCalledWith('some string failure');
    });
  });

  describe('handler', () => {
    beforeEach(async () => {
      vi.clearAllMocks();

      const walletModule = await import('../../../../src/utils/wallet');
      (walletModule.getWalletOrSigner as MockedFunction<any>).mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue('0xfrom'),
      });

      const configModule = await import('../../../../src/commands/gasless/config');
      (configModule.assertGaslessSupportedNetwork as MockedFunction<any>).mockImplementation(
        (network: string) => network,
      );
      (configModule.getGaslessFactoryAddress as MockedFunction<any>).mockReturnValue(
        '0xfactoryfactoryfactoryfactoryfactoryfacto',
      );

      const utils = await import('../../../../src/utils');
      (utils.getSupportedNetwork as MockedFunction<any>).mockReturnValue({ networkId: 11155111 });
      (utils.getEtherscanAddress as MockedFunction<any>).mockReturnValue(
        'https://sepolia.etherscan.io',
      );
      (utils.getErrorMessage as MockedFunction<any>).mockImplementation((e: any) =>
        e instanceof Error ? e.message : String(e),
      );
    });

    it('wires promptForDeployPlatformPaymasterInputs into runDeployPlatformPaymaster', async () => {
      const utils = await import('../../../../src/utils');
      const prompts = await import('@inquirer/prompts');
      const trustvcModule = await import('@trustvc/trustvc');

      (utils.promptNetworkSelection as any).mockResolvedValue('sepolia');
      (utils.promptAddress as any).mockResolvedValue('0x1234567890123456789012345678901234567890');
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });
      (prompts.input as any).mockResolvedValueOnce(VALID_SALT).mockResolvedValueOnce('');
      (trustvcModule.deployPlatformPaymaster as MockedFunction<any>).mockResolvedValue({
        txHash: '0xtxhash',
        paymasterAddress: '0xpaymasteraddresspaymasteraddresspaymast',
      });

      const result = await handler();

      expect(result).toBe('0xpaymasteraddresspaymasteraddresspaymast');
    });

    it('catches Error exceptions thrown while prompting', async () => {
      const utils = await import('../../../../src/utils');
      (utils.promptNetworkSelection as any).mockRejectedValue(new Error('prompt blew up'));

      const result = await handler();

      const signaleModule = await import('signale');
      expect(result).toBeUndefined();
      expect(signaleModule.error).toHaveBeenCalledWith('prompt blew up');
    });

    it('catches non-Error exceptions thrown while prompting', async () => {
      const utils = await import('../../../../src/utils');
      (utils.promptNetworkSelection as any).mockRejectedValue('raw string failure');

      const result = await handler();

      const signaleModule = await import('signale');
      expect(result).toBeUndefined();
      expect(signaleModule.error).toHaveBeenCalledWith('raw string failure');
    });
  });
});
