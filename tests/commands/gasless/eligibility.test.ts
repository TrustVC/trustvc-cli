import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import {
  checkGaslessEligibility,
  checkGaslessDeployEligibility,
  checkGaslessMintEligibility,
} from '../../../src/commands/gasless/eligibility';

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

vi.mock('../../../src/commands/gasless/config', () => ({
  getViemChain: vi.fn(),
  getGaslessRpcUrl: vi.fn(),
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: vi.fn(),
  };
});

const network = 'sepolia' as any;
const paymasterAddress = '0xpaymaster000000000000000000000000000000' as `0x${string}`;
const callerAddress = '0xcaller00000000000000000000000000000000' as `0x${string}`;
const titleEscrowAddress = '0xescrow000000000000000000000000000000000' as `0x${string}`;
const registryAddress = '0xregistry0000000000000000000000000000000' as `0x${string}`;

describe('gasless/eligibility', () => {
  let getCodeMock: MockedFunction<any>;
  let readContractMock: MockedFunction<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    const configModule = await import('../../../src/commands/gasless/config');
    (configModule.getViemChain as MockedFunction<any>).mockReturnValue({ id: 11155111 });
    (configModule.getGaslessRpcUrl as MockedFunction<any>).mockReturnValue(
      'https://fake-rpc.example.com',
    );

    getCodeMock = vi.fn();
    readContractMock = vi.fn();

    const viemModule = await import('viem');
    (viemModule.createPublicClient as MockedFunction<any>).mockReturnValue({
      getCode: getCodeMock,
      readContract: readContractMock,
    });
  });

  describe('checkGaslessEligibility', () => {
    const allPassingReadContract = ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'authorizedTitleEscrows':
        case 'authorizedRegistries':
        case 'authorizedCallers':
          return Promise.resolve(true);
        case 'getUserDailySpend':
          return Promise.resolve([0n, 100n, 0n]);
        case 'getDeposit':
          return Promise.resolve(1n);
        default:
          throw new Error(`Unexpected functionName: ${functionName}`);
      }
    };

    it('throws when there is no contract code at the paymaster address', async () => {
      getCodeMock.mockResolvedValue('0x');

      await expect(
        checkGaslessEligibility({
          network,
          paymasterAddress,
          callerAddress,
          titleEscrowAddress,
        }),
      ).rejects.toThrow(/No PlatformPaymaster contract found/);

      expect(readContractMock).not.toHaveBeenCalled();
    });

    it('throws when there is undefined contract code at the paymaster address', async () => {
      getCodeMock.mockResolvedValue(undefined);

      await expect(
        checkGaslessEligibility({
          network,
          paymasterAddress,
          callerAddress,
          titleEscrowAddress,
        }),
      ).rejects.toThrow(/No PlatformPaymaster contract found/);
    });

    it('throws naming authorizedTitleEscrows when the title escrow is not authorized', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'authorizedTitleEscrows') return Promise.resolve(false);
        return allPassingReadContract({ functionName });
      });

      await expect(
        checkGaslessEligibility({
          network,
          paymasterAddress,
          callerAddress,
          titleEscrowAddress,
        }),
      ).rejects.toThrow(/title escrow .* is not.*authorized/);
    });

    it('throws naming authorizedRegistries when the registry is not authorized', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'authorizedRegistries') return Promise.resolve(false);
        return allPassingReadContract({ functionName });
      });

      await expect(
        checkGaslessEligibility({
          network,
          paymasterAddress,
          callerAddress,
          registryAddress,
        }),
      ).rejects.toThrow(/token registry .* is not.*authorized/);
    });

    it('throws when the caller is not authorized', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'authorizedCallers') return Promise.resolve(false);
        return allPassingReadContract({ functionName });
      });

      await expect(
        checkGaslessEligibility({
          network,
          paymasterAddress,
          callerAddress,
          titleEscrowAddress,
        }),
      ).rejects.toThrow(/is not an authorized caller/);
    });

    it('throws when the daily limit has been reached (limit > 0 and spent >= limit)', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'getUserDailySpend') return Promise.resolve([100n, 100n, 0n]);
        return allPassingReadContract({ functionName });
      });

      await expect(
        checkGaslessEligibility({
          network,
          paymasterAddress,
          callerAddress,
          titleEscrowAddress,
        }),
      ).rejects.toThrow(/daily sponsored-gas limit reached/);
    });

    it('never throws for the daily limit when limit === 0 (unlimited), even with huge spend', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'getUserDailySpend') {
          return Promise.resolve([1_000_000_000n, 0n, 0n]);
        }
        return allPassingReadContract({ functionName });
      });

      await expect(
        checkGaslessEligibility({
          network,
          paymasterAddress,
          callerAddress,
          titleEscrowAddress,
        }),
      ).resolves.toBeUndefined();
    });

    it('throws when the paymaster has a zero deposit', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'getDeposit') return Promise.resolve(0n);
        return allPassingReadContract({ functionName });
      });

      await expect(
        checkGaslessEligibility({
          network,
          paymasterAddress,
          callerAddress,
          titleEscrowAddress,
        }),
      ).rejects.toThrow(/no ETH deposited at the EntryPoint/);
    });

    it('resolves without throwing when all checks pass (title escrow variant)', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(allPassingReadContract);

      await expect(
        checkGaslessEligibility({
          network,
          paymasterAddress,
          callerAddress,
          titleEscrowAddress,
        }),
      ).resolves.toBeUndefined();
    });

    it('resolves without throwing when all checks pass (registry variant)', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(allPassingReadContract);

      await expect(
        checkGaslessEligibility({
          network,
          paymasterAddress,
          callerAddress,
          registryAddress,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('checkGaslessDeployEligibility', () => {
    const allPassingReadContract = ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'userWhitelist':
          return Promise.resolve(1n);
        case 'getDeposit':
          return Promise.resolve(1n);
        default:
          throw new Error(`Unexpected functionName: ${functionName}`);
      }
    };

    it('throws when there is no contract code at the paymaster address', async () => {
      getCodeMock.mockResolvedValue('0x');

      await expect(
        checkGaslessDeployEligibility({ network, paymasterAddress, callerAddress }),
      ).rejects.toThrow(/No PlatformPaymaster contract found/);
    });

    it('throws when the caller has zero deployment credits', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'userWhitelist') return Promise.resolve(0n);
        return allPassingReadContract({ functionName });
      });

      await expect(
        checkGaslessDeployEligibility({ network, paymasterAddress, callerAddress }),
      ).rejects.toThrow(/no deployment\s*credits/);
    });

    it('throws when the paymaster has a zero deposit', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'getDeposit') return Promise.resolve(0n);
        return allPassingReadContract({ functionName });
      });

      await expect(
        checkGaslessDeployEligibility({ network, paymasterAddress, callerAddress }),
      ).rejects.toThrow(/no ETH deposited at the EntryPoint/);
    });

    it('resolves without throwing when all checks pass', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(allPassingReadContract);

      await expect(
        checkGaslessDeployEligibility({ network, paymasterAddress, callerAddress }),
      ).resolves.toBeUndefined();
    });
  });

  describe('checkGaslessMintEligibility', () => {
    const allPassingReadContract = ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'hasRole':
          return Promise.resolve(true);
        case 'authorizedRegistries':
          return Promise.resolve(true);
        case 'getDeposit':
          return Promise.resolve(1n);
        default:
          throw new Error(`Unexpected functionName: ${functionName}`);
      }
    };

    it('throws when there is no contract code at the paymaster address', async () => {
      getCodeMock.mockResolvedValue('0x');

      await expect(
        checkGaslessMintEligibility({ network, paymasterAddress, registryAddress }),
      ).rejects.toThrow(/No PlatformPaymaster contract found/);
    });

    it('throws when the paymaster lacks MINTER_ROLE on the registry', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'hasRole') return Promise.resolve(false);
        return allPassingReadContract({ functionName });
      });

      await expect(
        checkGaslessMintEligibility({ network, paymasterAddress, registryAddress }),
      ).rejects.toThrow(/does not hold MINTER_ROLE/);
    });

    it('throws when the registry is not authorized on the paymaster', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'authorizedRegistries') return Promise.resolve(false);
        return allPassingReadContract({ functionName });
      });

      await expect(
        checkGaslessMintEligibility({ network, paymasterAddress, registryAddress }),
      ).rejects.toThrow(/is not authorized on the/);
    });

    it('throws when the paymaster has a zero deposit', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'getDeposit') return Promise.resolve(0n);
        return allPassingReadContract({ functionName });
      });

      await expect(
        checkGaslessMintEligibility({ network, paymasterAddress, registryAddress }),
      ).rejects.toThrow(/no ETH deposited at the EntryPoint/);
    });

    it('resolves without throwing when all checks pass', async () => {
      getCodeMock.mockResolvedValue('0xcode');
      readContractMock.mockImplementation(allPassingReadContract);

      await expect(
        checkGaslessMintEligibility({ network, paymasterAddress, registryAddress }),
      ).resolves.toBeUndefined();
    });
  });
});
