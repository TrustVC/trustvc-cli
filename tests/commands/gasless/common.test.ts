import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import {
  resolveTitleEscrowAddress,
  prepareGaslessRun,
  prepareGaslessRegistryRun,
} from '../../../src/commands/gasless/common';

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
    getSupportedNetwork: vi.fn(),
  };
});

vi.mock('../../../src/utils/wallet', () => ({
  getWalletOrSigner: vi.fn(),
}));

vi.mock('../../../src/commands/gasless/config', () => ({
  assertGaslessSupportedNetwork: vi.fn((n: string) => n),
}));

vi.mock('../../../src/commands/gasless/client', () => ({
  buildGaslessSmartAccountClient: vi.fn(),
}));

vi.mock('../../../src/commands/gasless/eligibility', () => ({
  checkGaslessEligibility: vi.fn(),
}));

vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ethers')>();
  return {
    ...actual,
    ethers: {
      ...actual.ethers,
      Contract: vi.fn(),
    },
  };
});

describe('gasless/common', () => {
  let getSupportedNetworkMock: MockedFunction<any>;
  let getWalletOrSignerMock: MockedFunction<any>;
  let assertGaslessSupportedNetworkMock: MockedFunction<any>;
  let buildGaslessSmartAccountClientMock: MockedFunction<any>;
  let checkGaslessEligibilityMock: MockedFunction<any>;
  let ContractMock: MockedFunction<any>;

  const fakeProvider = { __brand: 'provider' };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    const utilsModule = await import('../../../src/utils');
    getSupportedNetworkMock = utilsModule.getSupportedNetwork as MockedFunction<any>;
    getSupportedNetworkMock.mockReturnValue({ provider: () => fakeProvider });

    const walletModule = await import('../../../src/utils/wallet');
    getWalletOrSignerMock = walletModule.getWalletOrSigner as MockedFunction<any>;

    const configModule = await import('../../../src/commands/gasless/config');
    assertGaslessSupportedNetworkMock =
      configModule.assertGaslessSupportedNetwork as MockedFunction<any>;
    assertGaslessSupportedNetworkMock.mockImplementation((n: string) => n);

    const clientModule = await import('../../../src/commands/gasless/client');
    buildGaslessSmartAccountClientMock =
      clientModule.buildGaslessSmartAccountClient as MockedFunction<any>;

    const eligibilityModule = await import('../../../src/commands/gasless/eligibility');
    checkGaslessEligibilityMock = eligibilityModule.checkGaslessEligibility as MockedFunction<any>;
    checkGaslessEligibilityMock.mockResolvedValue(undefined);

    const ethersModule = await import('ethers');
    ContractMock = ethersModule.ethers.Contract as MockedFunction<any>;
  });

  describe('resolveTitleEscrowAddress', () => {
    it('returns the resolved title escrow address from ownerOf', async () => {
      const escrowAddress = '0xescrow000000000000000000000000000000000';
      ContractMock.mockImplementation(() => ({
        ownerOf: vi.fn().mockResolvedValue(escrowAddress),
      }));

      const result = await resolveTitleEscrowAddress({
        tokenRegistryAddress: '0xregistry0000000000000000000000000000000',
        tokenId: '0x1',
        network: 'sepolia',
      });

      expect(result).toBe(escrowAddress);
    });

    it('throws when ownerOf resolves to the zero address', async () => {
      const ethersModule = await import('ethers');
      ContractMock.mockImplementation(() => ({
        ownerOf: vi.fn().mockResolvedValue(ethersModule.ethers.ZeroAddress),
      }));

      await expect(
        resolveTitleEscrowAddress({
          tokenRegistryAddress: '0xregistry0000000000000000000000000000000',
          tokenId: '0x1',
          network: 'sepolia',
        }),
      ).rejects.toThrow(/Unable to resolve the title escrow address/);
    });

    it('throws when ownerOf resolves to a falsy value', async () => {
      ContractMock.mockImplementation(() => ({
        ownerOf: vi.fn().mockResolvedValue(''),
      }));

      await expect(
        resolveTitleEscrowAddress({
          tokenRegistryAddress: '0xregistry0000000000000000000000000000000',
          tokenId: '0x1',
          network: 'sepolia',
        }),
      ).rejects.toThrow(/Unable to resolve the title escrow address/);
    });
  });

  describe('prepareGaslessRun', () => {
    const titleEscrowAddress = '0xescrow000000000000000000000000000000000';
    const callerAddress = '0xCaLLeR000000000000000000000000000000000';
    const paymasterAddress = '0xpaymaster000000000000000000000000000000';

    beforeEach(() => {
      ContractMock.mockImplementation(() => ({
        ownerOf: vi.fn().mockResolvedValue(titleEscrowAddress),
        holder: vi.fn().mockResolvedValue(callerAddress),
        beneficiary: vi.fn().mockResolvedValue(callerAddress),
      }));

      buildGaslessSmartAccountClientMock.mockResolvedValue({
        smartAccountClient: { __brand: 'smartAccountClient' },
      });
    });

    it('throws when the resolved wallet has no privateKey', async () => {
      getWalletOrSignerMock.mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue(callerAddress),
      });

      await expect(
        prepareGaslessRun({
          network: 'sepolia',
          tokenRegistryAddress: '0xregistry0000000000000000000000000000000',
          tokenId: '0x1',
          paymasterAddress,
          requiredRoles: ['holder'],
        }),
      ).rejects.toThrow(/Gasless transactions require direct access to a private key/);
    });

    it('throws when the caller address does not match the required role holder (case-insensitive compare still matches when equal)', async () => {
      getWalletOrSignerMock.mockResolvedValue({
        privateKey: '0xprivatekey',
        getAddress: vi.fn().mockResolvedValue('0xDIFFERENTADDRESS00000000000000000000000'),
      });

      await expect(
        prepareGaslessRun({
          network: 'sepolia',
          tokenRegistryAddress: '0xregistry0000000000000000000000000000000',
          tokenId: '0x1',
          paymasterAddress,
          requiredRoles: ['holder'],
        }),
      ).rejects.toThrow(/is not the current holder/);
    });

    it('does not throw when the caller address matches the role holder in a different case', async () => {
      getWalletOrSignerMock.mockResolvedValue({
        privateKey: '0xprivatekey',
        getAddress: vi.fn().mockResolvedValue(callerAddress.toUpperCase()),
      });

      await expect(
        prepareGaslessRun({
          network: 'sepolia',
          tokenRegistryAddress: '0xregistry0000000000000000000000000000000',
          tokenId: '0x1',
          paymasterAddress,
          requiredRoles: ['holder'],
        }),
      ).resolves.toBeDefined();
    });

    it('calls checkGaslessEligibility with titleEscrowAddress (not registryAddress)', async () => {
      getWalletOrSignerMock.mockResolvedValue({
        privateKey: '0xprivatekey',
        getAddress: vi.fn().mockResolvedValue(callerAddress),
      });

      await prepareGaslessRun({
        network: 'sepolia',
        tokenRegistryAddress: '0xregistry0000000000000000000000000000000',
        tokenId: '0x1',
        paymasterAddress,
        requiredRoles: ['holder'],
      });

      expect(checkGaslessEligibilityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          titleEscrowAddress,
        }),
      );
      const callArgs = checkGaslessEligibilityMock.mock.calls[0][0] as any;
      expect(callArgs.registryAddress).toBeUndefined();
    });

    it('returns network, titleEscrowAddress, callerAddress, smartAccountClient on success', async () => {
      const fakeSmartAccountClient = { __brand: 'smartAccountClient' };
      buildGaslessSmartAccountClientMock.mockResolvedValue({
        smartAccountClient: fakeSmartAccountClient,
      });
      getWalletOrSignerMock.mockResolvedValue({
        privateKey: '0xprivatekey',
        getAddress: vi.fn().mockResolvedValue(callerAddress),
      });

      const result = await prepareGaslessRun({
        network: 'sepolia',
        tokenRegistryAddress: '0xregistry0000000000000000000000000000000',
        tokenId: '0x1',
        paymasterAddress,
        requiredRoles: ['holder'],
      });

      expect(result).toEqual({
        network: 'sepolia',
        titleEscrowAddress,
        callerAddress,
        smartAccountClient: fakeSmartAccountClient,
      });
    });
  });

  describe('prepareGaslessRegistryRun', () => {
    const callerAddress = '0xCaLLeR000000000000000000000000000000000';
    const paymasterAddress = '0xpaymaster000000000000000000000000000000';
    const tokenRegistryAddress = '0xregistry0000000000000000000000000000000';

    beforeEach(() => {
      buildGaslessSmartAccountClientMock.mockResolvedValue({
        smartAccountClient: { __brand: 'smartAccountClient' },
      });
    });

    it('throws when the resolved wallet has no privateKey', async () => {
      getWalletOrSignerMock.mockResolvedValue({
        getAddress: vi.fn().mockResolvedValue(callerAddress),
      });

      await expect(
        prepareGaslessRegistryRun({
          network: 'sepolia',
          tokenRegistryAddress,
          paymasterAddress,
        }),
      ).rejects.toThrow(/Gasless transactions require direct access to a private key/);
    });

    it('calls checkGaslessEligibility with registryAddress (not titleEscrowAddress) and never constructs a title escrow contract', async () => {
      getWalletOrSignerMock.mockResolvedValue({
        privateKey: '0xprivatekey',
        getAddress: vi.fn().mockResolvedValue(callerAddress),
      });

      await prepareGaslessRegistryRun({
        network: 'sepolia',
        tokenRegistryAddress,
        paymasterAddress,
      });

      expect(checkGaslessEligibilityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          registryAddress: tokenRegistryAddress,
        }),
      );
      const callArgs = checkGaslessEligibilityMock.mock.calls[0][0] as any;
      expect(callArgs.titleEscrowAddress).toBeUndefined();
      expect(ContractMock).not.toHaveBeenCalled();
    });

    it('returns network, callerAddress, smartAccountClient (no titleEscrowAddress field) on success', async () => {
      const fakeSmartAccountClient = { __brand: 'smartAccountClient' };
      buildGaslessSmartAccountClientMock.mockResolvedValue({
        smartAccountClient: fakeSmartAccountClient,
      });
      getWalletOrSignerMock.mockResolvedValue({
        privateKey: '0xprivatekey',
        getAddress: vi.fn().mockResolvedValue(callerAddress),
      });

      const result = await prepareGaslessRegistryRun({
        network: 'sepolia',
        tokenRegistryAddress,
        paymasterAddress,
      });

      expect(result).toEqual({
        network: 'sepolia',
        callerAddress,
        smartAccountClient: fakeSmartAccountClient,
      });
      expect(result).not.toHaveProperty('titleEscrowAddress');
    });
  });
});
