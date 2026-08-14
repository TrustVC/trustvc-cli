import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gaslessConstants } from '@trustvc/trustvc';
import { sepolia, polygonAmoy } from 'viem/chains';
import { NetworkCmdName } from '../../../src/utils';
import {
  isGaslessSupportedNetwork,
  assertGaslessSupportedNetwork,
  getViemChain,
  getPimlicoApiKey,
  getEip7702ImplementationAddress,
  getGaslessRpcUrl,
  getPimlicoBundlerUrl,
  getGaslessFactoryAddress,
} from '../../../src/commands/gasless/config';

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

vi.mock('@trustvc/trustvc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@trustvc/trustvc')>();
  return {
    ...actual,
  };
});

vi.mock('../../../src/utils', async (importOriginal) => {
  const originalUtils = await importOriginal<typeof import('../../../src/utils')>();
  return {
    ...originalUtils,
  };
});

describe('gasless/config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('isGaslessSupportedNetwork', () => {
    it('returns true for sepolia', () => {
      expect(isGaslessSupportedNetwork(NetworkCmdName.Sepolia)).toBe(true);
    });

    it('returns true for amoy', () => {
      expect(isGaslessSupportedNetwork(NetworkCmdName.Amoy)).toBe(true);
    });

    it('returns false for mainnet', () => {
      expect(isGaslessSupportedNetwork(NetworkCmdName.Mainnet)).toBe(false);
    });

    it('returns false for an unrecognized network string', () => {
      expect(isGaslessSupportedNetwork('not-a-network')).toBe(false);
    });
  });

  describe('assertGaslessSupportedNetwork', () => {
    it('returns the network unchanged for sepolia', () => {
      expect(assertGaslessSupportedNetwork(NetworkCmdName.Sepolia)).toBe(NetworkCmdName.Sepolia);
    });

    it('returns the network unchanged for amoy', () => {
      expect(assertGaslessSupportedNetwork(NetworkCmdName.Amoy)).toBe(NetworkCmdName.Amoy);
    });

    it('throws for mainnet', () => {
      expect(() => assertGaslessSupportedNetwork(NetworkCmdName.Mainnet)).toThrow(
        /Gasless transactions are only supported on/,
      );
    });

    it('throws for an unsupported arbitrary network', () => {
      expect(() => assertGaslessSupportedNetwork('mainnet')).toThrow();
    });
  });

  describe('getViemChain', () => {
    it('returns the sepolia viem chain for sepolia', () => {
      expect(getViemChain(NetworkCmdName.Sepolia)).toBe(sepolia);
    });

    it('returns the polygonAmoy viem chain for amoy', () => {
      expect(getViemChain(NetworkCmdName.Amoy)).toBe(polygonAmoy);
    });
  });

  describe('getPimlicoApiKey', () => {
    it('throws when PIMLICO_API_KEY is not set', () => {
      delete process.env.PIMLICO_API_KEY;
      expect(() => getPimlicoApiKey()).toThrow(
        'PIMLICO_API_KEY environment variable is required for gasless transactions. ' +
          'Get an API key from https://dashboard.pimlico.io and set it in your environment.',
      );
    });

    it('returns the api key when set', () => {
      process.env.PIMLICO_API_KEY = 'test-api-key';
      expect(getPimlicoApiKey()).toBe('test-api-key');
    });
  });

  describe('getEip7702ImplementationAddress', () => {
    const validAddress = '0x1234567890123456789012345678901234567890';

    it('throws when neither scoped nor generic env var is set for sepolia', () => {
      delete process.env.SEPOLIA_EIP7702_IMPL_ADDRESS;
      delete process.env.EIP7702_IMPL_ADDRESS;
      expect(() => getEip7702ImplementationAddress(NetworkCmdName.Sepolia)).toThrow(
        /Missing EIP-7702 implementation address for sepolia/,
      );
    });

    it('throws when neither scoped nor generic env var is set for amoy', () => {
      delete process.env.AMOY_EIP7702_IMPL_ADDRESS;
      delete process.env.EIP7702_IMPL_ADDRESS;
      expect(() => getEip7702ImplementationAddress(NetworkCmdName.Amoy)).toThrow(
        /Missing EIP-7702 implementation address for amoy/,
      );
    });

    it('uses the scoped SEPOLIA_EIP7702_IMPL_ADDRESS env var when set', () => {
      process.env.SEPOLIA_EIP7702_IMPL_ADDRESS = validAddress;
      delete process.env.EIP7702_IMPL_ADDRESS;
      expect(getEip7702ImplementationAddress(NetworkCmdName.Sepolia)).toBe(validAddress);
    });

    it('uses the scoped AMOY_EIP7702_IMPL_ADDRESS env var when set', () => {
      process.env.AMOY_EIP7702_IMPL_ADDRESS = validAddress;
      delete process.env.EIP7702_IMPL_ADDRESS;
      expect(getEip7702ImplementationAddress(NetworkCmdName.Amoy)).toBe(validAddress);
    });

    it('falls back to the generic EIP7702_IMPL_ADDRESS when scoped is unset (sepolia)', () => {
      delete process.env.SEPOLIA_EIP7702_IMPL_ADDRESS;
      process.env.EIP7702_IMPL_ADDRESS = validAddress;
      expect(getEip7702ImplementationAddress(NetworkCmdName.Sepolia)).toBe(validAddress);
    });

    it('falls back to the generic EIP7702_IMPL_ADDRESS when scoped is unset (amoy)', () => {
      delete process.env.AMOY_EIP7702_IMPL_ADDRESS;
      process.env.EIP7702_IMPL_ADDRESS = validAddress;
      expect(getEip7702ImplementationAddress(NetworkCmdName.Amoy)).toBe(validAddress);
    });

    it('prefers the scoped env var over the generic one', () => {
      const scopedAddress = '0x1111111111111111111111111111111111111111';
      process.env.SEPOLIA_EIP7702_IMPL_ADDRESS = scopedAddress;
      process.env.EIP7702_IMPL_ADDRESS = validAddress;
      expect(getEip7702ImplementationAddress(NetworkCmdName.Sepolia)).toBe(scopedAddress);
    });

    it('throws when the address is not a valid 0x + 40 hex char address', () => {
      process.env.SEPOLIA_EIP7702_IMPL_ADDRESS = '0xnotavalidaddress';
      expect(() => getEip7702ImplementationAddress(NetworkCmdName.Sepolia)).toThrow(
        /Invalid EIP-7702 implementation address/,
      );
    });

    it('throws when the address is missing the 0x prefix', () => {
      process.env.SEPOLIA_EIP7702_IMPL_ADDRESS = '1234567890123456789012345678901234567890';
      expect(() => getEip7702ImplementationAddress(NetworkCmdName.Sepolia)).toThrow(
        /Invalid EIP-7702 implementation address/,
      );
    });
  });

  describe('getGaslessRpcUrl', () => {
    it('returns the SEPOLIA_RPC env var when set', () => {
      process.env.SEPOLIA_RPC = 'https://custom-sepolia-rpc.example.com';
      expect(getGaslessRpcUrl(NetworkCmdName.Sepolia)).toBe(
        'https://custom-sepolia-rpc.example.com',
      );
    });

    it('returns the AMOY_RPC env var when set', () => {
      process.env.AMOY_RPC = 'https://custom-amoy-rpc.example.com';
      expect(getGaslessRpcUrl(NetworkCmdName.Amoy)).toBe('https://custom-amoy-rpc.example.com');
    });

    it('returns the hardcoded default for sepolia when env var unset', () => {
      delete process.env.SEPOLIA_RPC;
      expect(getGaslessRpcUrl(NetworkCmdName.Sepolia)).toBe(
        'https://ethereum-sepolia-rpc.publicnode.com',
      );
    });

    it('returns the hardcoded default for amoy when env var unset', () => {
      delete process.env.AMOY_RPC;
      expect(getGaslessRpcUrl(NetworkCmdName.Amoy)).toBe(
        'https://polygon-amoy-bor-rpc.publicnode.com',
      );
    });
  });

  describe('getPimlicoBundlerUrl', () => {
    it('builds the exact expected URL for sepolia', () => {
      expect(getPimlicoBundlerUrl(NetworkCmdName.Sepolia, 'my-api-key')).toBe(
        `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=my-api-key`,
      );
    });

    it('builds the exact expected URL for amoy', () => {
      expect(getPimlicoBundlerUrl(NetworkCmdName.Amoy, 'my-api-key')).toBe(
        `https://api.pimlico.io/v2/${polygonAmoy.id}/rpc?apikey=my-api-key`,
      );
    });
  });

  describe('getGaslessFactoryAddress', () => {
    it('returns the real GASLESS_FACTORY_ADDRESS_SEPOLIA for sepolia', () => {
      expect(getGaslessFactoryAddress(NetworkCmdName.Sepolia)).toBe(
        gaslessConstants.GASLESS_FACTORY_ADDRESS_SEPOLIA,
      );
    });

    it('returns the real GASLESS_FACTORY_ADDRESS_AMOY for amoy', () => {
      expect(getGaslessFactoryAddress(NetworkCmdName.Amoy)).toBe(
        gaslessConstants.GASLESS_FACTORY_ADDRESS_AMOY,
      );
    });
  });
});
