import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import { v5ContractAddress } from '@trustvc/trustvc';
import {
  promptForDeployTokenRegistryGaslessInputs,
  runDeployTokenRegistryGasless,
} from '../../../../src/commands/gasless/deploy/deploy-token-registry-gasless';

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
    deployTokenRegistryGasless: vi.fn(),
  };
});

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: vi.fn(),
    http: vi.fn(),
    parseEventLogs: vi.fn(),
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
    promptAddress: vi.fn(),
    promptNetworkSelection: vi.fn(),
    promptWalletSelection: vi.fn(),
  };
});

vi.mock('../../../../src/commands/gasless/config', () => ({
  assertGaslessSupportedNetwork: vi.fn((network: string) => network),
  getGaslessRpcUrl: vi.fn(() => 'https://sepolia.example-rpc.com'),
  getViemChain: vi.fn(() => ({ id: 11155111 })),
}));

vi.mock('../../../../src/commands/gasless/client', () => ({
  buildGaslessSmartAccountClient: vi.fn(),
}));

vi.mock('../../../../src/commands/gasless/eligibility', () => ({
  checkGaslessDeployEligibility: vi.fn(),
}));

// Real chain ID with a known default TokenImplementation address in @trustvc/trustvc's real
// v5ContractAddress map (kept real per instructions, not stubbed).
const CHAIN_ID_WITH_DEFAULT = 11155111;
const DEFAULT_IMPL_ADDRESS = v5ContractAddress.TokenImplementation[CHAIN_ID_WITH_DEFAULT];
// A chain ID with no entry in the real map at all.
const CHAIN_ID_WITHOUT_DEFAULT = 999999;

describe('gasless/deploy/deploy-token-registry-gasless', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForDeployTokenRegistryGaslessInputs', () => {
    beforeEach(async () => {
      const utils = await import('../../../../src/utils');
      const configModule = await import('../../../../src/commands/gasless/config');

      (utils.promptNetworkSelection as any).mockResolvedValue('sepolia');
      (utils.promptWalletSelection as any).mockResolvedValue({
        encryptedWalletPath: './wallet.json',
      });
      (configModule.getViemChain as MockedFunction<any>).mockReturnValue({
        id: CHAIN_ID_WITH_DEFAULT,
      });
    });

    it('returns the correct shape for valid inputs', async () => {
      const utils = await import('../../../../src/utils');
      const prompts = await import('@inquirer/prompts');

      (prompts.input as any).mockResolvedValueOnce('My Registry').mockResolvedValueOnce('MTR');
      (utils.promptAddress as any)
        .mockResolvedValueOnce('0xpaymasterpaymasterpaymasterpaymasterpay')
        .mockResolvedValueOnce('0ximplimplimplimplimplimplimplimplimplim');

      const result = await promptForDeployTokenRegistryGaslessInputs();

      expect(result.network).toBe('sepolia');
      expect(result.registryName).toBe('My Registry');
      expect(result.registrySymbol).toBe('MTR');
      expect(result.paymasterAddress).toBe('0xpaymasterpaymasterpaymasterpaymasterpay');
      expect(result.tokenRegistryImplAddress).toBe('0ximplimplimplimplimplimplimplimplimplim');
      expect((result as any).encryptedWalletPath).toBe('./wallet.json');
    });

    it('falls back to the default implementation address when the user leaves it blank', async () => {
      const utils = await import('../../../../src/utils');
      const prompts = await import('@inquirer/prompts');

      (prompts.input as any).mockResolvedValueOnce('My Registry').mockResolvedValueOnce('MTR');
      (utils.promptAddress as any)
        .mockResolvedValueOnce('0xpaymasterpaymasterpaymasterpaymasterpay')
        .mockResolvedValueOnce(undefined);

      const result = await promptForDeployTokenRegistryGaslessInputs();

      expect(result.tokenRegistryImplAddress).toBe(DEFAULT_IMPL_ADDRESS);
    });

    it('marks the impl address prompt optional when a default exists for the resolved chain', async () => {
      const utils = await import('../../../../src/utils');
      const prompts = await import('@inquirer/prompts');
      const configModule = await import('../../../../src/commands/gasless/config');

      (configModule.getViemChain as MockedFunction<any>).mockReturnValue({
        id: CHAIN_ID_WITH_DEFAULT,
      });
      (prompts.input as any).mockResolvedValueOnce('My Registry').mockResolvedValueOnce('MTR');
      (utils.promptAddress as any)
        .mockResolvedValueOnce('0xpaymasterpaymasterpaymasterpaymasterpay')
        .mockResolvedValueOnce('0ximplimplimplimplimplimplimplimplimplim');

      await promptForDeployTokenRegistryGaslessInputs();

      const implCallArgs = (utils.promptAddress as MockedFunction<any>).mock.calls[1];
      expect(implCallArgs[0]).toBe('token registry implementation');
      expect(implCallArgs[2]).toBe(true);
    });

    it('marks the impl address prompt required when no default exists for the resolved chain', async () => {
      const utils = await import('../../../../src/utils');
      const prompts = await import('@inquirer/prompts');
      const configModule = await import('../../../../src/commands/gasless/config');

      (configModule.getViemChain as MockedFunction<any>).mockReturnValue({
        id: CHAIN_ID_WITHOUT_DEFAULT,
      });
      (prompts.input as any).mockResolvedValueOnce('My Registry').mockResolvedValueOnce('MTR');
      (utils.promptAddress as any)
        .mockResolvedValueOnce('0xpaymasterpaymasterpaymasterpaymasterpay')
        .mockResolvedValueOnce('0xexplicitimpladdressexplicitimpladdres');

      await promptForDeployTokenRegistryGaslessInputs();

      const implCallArgs = (utils.promptAddress as MockedFunction<any>).mock.calls[1];
      expect(implCallArgs[2]).toBe(false);
    });

    describe('registry name/symbol validate', () => {
      const getValidateFns = async () => {
        const utils = await import('../../../../src/utils');
        const prompts = await import('@inquirer/prompts');

        (prompts.input as any).mockResolvedValueOnce('My Registry').mockResolvedValueOnce('MTR');
        (utils.promptAddress as any)
          .mockResolvedValueOnce('0xpaymasterpaymasterpaymasterpaymasterpay')
          .mockResolvedValueOnce('0ximplimplimplimplimplimplimplimplimplim');

        await promptForDeployTokenRegistryGaslessInputs();

        const calls = (prompts.input as MockedFunction<any>).mock.calls as any[];
        return { nameValidate: calls[0][0].validate, symbolValidate: calls[1][0].validate };
      };

      it('rejects a blank registry name', async () => {
        const { nameValidate } = await getValidateFns();
        expect(nameValidate('')).toBe('Registry name is required');
        expect(nameValidate('   ')).toBe('Registry name is required');
      });

      it('accepts a non-blank registry name', async () => {
        const { nameValidate } = await getValidateFns();
        expect(nameValidate('My Registry')).toBe(true);
      });

      it('rejects a blank registry symbol', async () => {
        const { symbolValidate } = await getValidateFns();
        expect(symbolValidate('')).toBe('Registry symbol is required');
        expect(symbolValidate('   ')).toBe('Registry symbol is required');
      });

      it('accepts a non-blank registry symbol', async () => {
        const { symbolValidate } = await getValidateFns();
        expect(symbolValidate('MTR')).toBe(true);
      });
    });
  });

  describe('runDeployTokenRegistryGasless', () => {
    const baseArgs = {
      network: 'sepolia',
      registryName: 'My Registry',
      registrySymbol: 'MTR',
      paymasterAddress: '0xpaymasterpaymasterpaymasterpaymasterpay',
      tokenRegistryImplAddress: '0ximplimplimplimplimplimplimplimplimplim',
      encryptedWalletPath: './wallet.json',
    };

    const walletWithPrivateKey = {
      privateKey: '0xprivatekeyprivatekeyprivatekeyprivatekeyprivatekeyprivatekey12',
      getAddress: vi.fn().mockResolvedValue('0xcalleraddresscalleraddresscalleraddres'),
    };

    const smartAccountClientResult = {
      smartAccountClient: { sendTransaction: vi.fn() },
      smartAccountAddress: '0xsmartaccountsmartaccountsmartaccounts',
    };

    beforeEach(async () => {
      walletWithPrivateKey.getAddress.mockResolvedValue('0xcalleraddresscalleraddresscalleraddres');

      const walletModule = await import('../../../../src/utils/wallet');
      (walletModule.getWalletOrSigner as MockedFunction<any>).mockResolvedValue(
        walletWithPrivateKey,
      );

      const configModule = await import('../../../../src/commands/gasless/config');
      (configModule.assertGaslessSupportedNetwork as MockedFunction<any>).mockImplementation(
        (network: any) => network,
      );
      (configModule.getGaslessRpcUrl as MockedFunction<any>).mockReturnValue(
        'https://sepolia.example-rpc.com',
      );
      (configModule.getViemChain as MockedFunction<any>).mockReturnValue({
        id: CHAIN_ID_WITH_DEFAULT,
      });

      const eligibilityModule = await import('../../../../src/commands/gasless/eligibility');
      (eligibilityModule.checkGaslessDeployEligibility as MockedFunction<any>).mockResolvedValue(
        undefined,
      );

      const clientModule = await import('../../../../src/commands/gasless/client');
      (clientModule.buildGaslessSmartAccountClient as MockedFunction<any>).mockResolvedValue(
        smartAccountClientResult,
      );

      const trustvcModule = await import('@trustvc/trustvc');
      (trustvcModule.deployTokenRegistryGasless as MockedFunction<any>).mockResolvedValue(
        '0xtransactionhashtransactionhashtransac',
      );

      const viemModule = await import('viem');
      (viemModule.createPublicClient as MockedFunction<any>).mockReturnValue({
        getTransactionReceipt: vi.fn().mockResolvedValue({ logs: [{}] }),
      });
      (viemModule.http as MockedFunction<any>).mockReturnValue({});

      const utils = await import('../../../../src/utils');
      (utils.getErrorMessage as MockedFunction<any>).mockImplementation((e: any) =>
        e instanceof Error ? e.message : String(e),
      );
      (utils.getEtherscanAddress as MockedFunction<any>).mockReturnValue(
        'https://sepolia.etherscan.io',
      );
    });

    it('throws (internally caught) when the resolved wallet has no privateKey', async () => {
      const walletModule = await import('../../../../src/utils/wallet');
      (walletModule.getWalletOrSigner as MockedFunction<any>).mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue('0xcalleraddresscalleraddresscalleraddres'),
      });

      const result = await runDeployTokenRegistryGasless(baseArgs);

      const signaleModule = await import('signale');
      expect(result).toBeUndefined();
      expect(signaleModule.error).toHaveBeenCalledWith(
        expect.stringContaining('Gasless transactions require direct access to a private key'),
      );

      const eligibilityModule = await import('../../../../src/commands/gasless/eligibility');
      expect(eligibilityModule.checkGaslessDeployEligibility).not.toHaveBeenCalled();
    });

    it('checks eligibility, builds the smart account client, deploys, and returns the deployed address when the event is found', async () => {
      const viemModule = await import('viem');
      (viemModule.parseEventLogs as MockedFunction<any>).mockReturnValue([
        { args: { deployed: '0xdeployedaddressdeployedaddressdeploye' } },
      ]);

      const eligibilityModule = await import('../../../../src/commands/gasless/eligibility');
      const clientModule = await import('../../../../src/commands/gasless/client');
      const trustvcModule = await import('@trustvc/trustvc');

      const result = await runDeployTokenRegistryGasless(baseArgs);

      expect(eligibilityModule.checkGaslessDeployEligibility).toHaveBeenCalledWith({
        network: 'sepolia',
        paymasterAddress: baseArgs.paymasterAddress,
        callerAddress: '0xcalleraddresscalleraddresscalleraddres',
      });
      expect(clientModule.buildGaslessSmartAccountClient).toHaveBeenCalledWith({
        network: 'sepolia',
        privateKey: walletWithPrivateKey.privateKey,
        paymasterAddress: baseArgs.paymasterAddress,
      });
      expect(trustvcModule.deployTokenRegistryGasless).toHaveBeenCalledWith(
        baseArgs.registryName,
        baseArgs.registrySymbol,
        smartAccountClientResult.smartAccountClient,
        {
          paymasterAddress: baseArgs.paymasterAddress,
          tokenRegistryImplAddress: baseArgs.tokenRegistryImplAddress,
        },
      );
      expect(result).toBe('0xdeployedaddressdeployedaddressdeploye');

      const signaleModule = await import('signale');
      expect(signaleModule.success).toHaveBeenCalledWith(
        expect.stringContaining('deployed at 0xdeployedaddressdeployedaddressdeploye'),
      );
    });

    it('falls back to returning the raw transaction hash when no matching event is found', async () => {
      const viemModule = await import('viem');
      (viemModule.parseEventLogs as MockedFunction<any>).mockReturnValue([]);

      const result = await runDeployTokenRegistryGasless(baseArgs);

      expect(result).toBe('0xtransactionhashtransactionhashtransac');

      const signaleModule = await import('signale');
      expect(signaleModule.success).toHaveBeenCalledWith(
        expect.stringContaining('deployment submitted'),
      );
      expect(signaleModule.success).not.toHaveBeenCalledWith(
        expect.stringContaining('deployed at'),
      );
    });

    it('returns undefined and logs the error when checkGaslessDeployEligibility rejects with an Error', async () => {
      const eligibilityModule = await import('../../../../src/commands/gasless/eligibility');
      (eligibilityModule.checkGaslessDeployEligibility as MockedFunction<any>).mockRejectedValue(
        new Error('not whitelisted'),
      );

      const result = await runDeployTokenRegistryGasless(baseArgs);

      const signaleModule = await import('signale');
      expect(result).toBeUndefined();
      expect(signaleModule.error).toHaveBeenCalledWith('not whitelisted');
    });

    it('returns undefined and logs the error when checkGaslessDeployEligibility rejects with a non-Error', async () => {
      const eligibilityModule = await import('../../../../src/commands/gasless/eligibility');
      (eligibilityModule.checkGaslessDeployEligibility as MockedFunction<any>).mockRejectedValue(
        'raw failure',
      );

      const result = await runDeployTokenRegistryGasless(baseArgs);

      const signaleModule = await import('signale');
      expect(result).toBeUndefined();
      expect(signaleModule.error).toHaveBeenCalledWith('raw failure');
    });

    it('returns undefined and logs the error when deployTokenRegistryGasless rejects', async () => {
      const trustvcModule = await import('@trustvc/trustvc');
      (trustvcModule.deployTokenRegistryGasless as MockedFunction<any>).mockRejectedValue(
        new Error('userop reverted'),
      );

      const result = await runDeployTokenRegistryGasless(baseArgs);

      const signaleModule = await import('signale');
      expect(result).toBeUndefined();
      expect(signaleModule.error).toHaveBeenCalledWith('userop reverted');
    });

    it('returns undefined and logs the error when buildGaslessSmartAccountClient rejects', async () => {
      const clientModule = await import('../../../../src/commands/gasless/client');
      (clientModule.buildGaslessSmartAccountClient as MockedFunction<any>).mockRejectedValue(
        new Error('client build failed'),
      );

      const result = await runDeployTokenRegistryGasless(baseArgs);

      const signaleModule = await import('signale');
      expect(result).toBeUndefined();
      expect(signaleModule.error).toHaveBeenCalledWith('client build failed');
    });
  });
});
