import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  handler,
  deployObligationRegistryContract,
  promptForInputs,
} from '../../../src/commands/obligation-registry/deploy';
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
      warn = vi.fn();
      constructor() {}
    },
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    await: vi.fn(),
    default: {
      await: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  };
});

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
  password: vi.fn(),
}));

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    deployObligationRegistry: vi.fn(),
  };
});

vi.mock('../../../src/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils')>();
  return {
    ...actual,
    promptNetworkSelection: vi.fn().mockResolvedValue('amoy'),
    promptWalletSelection: vi.fn().mockResolvedValue({ key: '0xabc' }),
    promptAddress: vi.fn(),
    getWalletOrSigner: vi.fn().mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xWallet'),
      provider: {},
    }),
    performDryRunWithConfirmation: vi.fn().mockResolvedValue(true),
    displayTransactionPrice: vi.fn(),
    getEtherscanAddress: vi.fn().mockReturnValue('https://amoy.polygonscan.com'),
    getSupportedNetwork: vi.fn().mockReturnValue({ networkId: 80002 }),
    getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
    supportedNetwork: {
      amoy: { networkId: 80002 },
    },
  };
});

describe('obligation-registry/deploy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('promptForInputs', () => {
    it('collects registry name, symbol, and wallet', async () => {
      const { input, confirm } = await import('@inquirer/prompts');
      (input as MockedFunction<any>)
        .mockResolvedValueOnce('My BoE Registry')
        .mockResolvedValueOnce('BOE');
      (confirm as MockedFunction<any>).mockResolvedValueOnce(false);

      const result = await promptForInputs();
      expect(result.registryName).toBe('My BoE Registry');
      expect(result.registrySymbol).toBe('BOE');
      expect(result.network).toBe(NetworkCmdName.Amoy);
      expect(result.key).toBe('0xabc');
    });
  });

  describe('deployObligationRegistryContract', () => {
    it('deploys via SDK and returns registry address', async () => {
      const trustvc = await import('@trustvc/trustvc');
      const deployMock = trustvc.deployObligationRegistry as MockedFunction<any>;
      deployMock.mockResolvedValue({
        receipt: { hash: '0xhash', logs: [] },
        obligationRegistry: '0xRegistry',
        obligationEscrowFactoryAddress: '0xFactory',
      });

      const address = await deployObligationRegistryContract({
        network: NetworkCmdName.Amoy,
        registryName: 'My BoE Registry',
        registrySymbol: 'BOE',
        key: '0xabc',
        maxPriorityFeePerGasScale: 1,
      });

      expect(deployMock).toHaveBeenCalled();
      expect(address).toBe('0xRegistry');
    });
  });

  describe('handler', () => {
    it('runs without throwing when prompts succeed', async () => {
      const { input, confirm } = await import('@inquirer/prompts');
      (input as MockedFunction<any>)
        .mockResolvedValueOnce('My BoE Registry')
        .mockResolvedValueOnce('BOE');
      (confirm as MockedFunction<any>).mockResolvedValueOnce(false);

      const trustvc = await import('@trustvc/trustvc');
      (trustvc.deployObligationRegistry as MockedFunction<any>).mockResolvedValue({
        receipt: { hash: '0xhash', logs: [] },
        obligationRegistry: '0xRegistry',
        obligationEscrowFactoryAddress: '0xFactory',
      });

      await expect(handler()).resolves.toBeUndefined();
    });
  });
});
