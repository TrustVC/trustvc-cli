import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import { handler } from '../../../../src/commands/gasless/admin/delegate-user';

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

const { signAuthorizationMock, sendTransactionMock, createWalletClientMock } = vi.hoisted(() => {
  const signAuthorizationMock = vi.fn();
  const sendTransactionMock = vi.fn();
  const createWalletClientMock = vi.fn().mockImplementation(() => ({
    signAuthorization: signAuthorizationMock,
    sendTransaction: sendTransactionMock,
  }));
  return { signAuthorizationMock, sendTransactionMock, createWalletClientMock };
});

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    createWalletClient: createWalletClientMock,
    http: vi.fn(() => 'http-transport'),
  };
});

vi.mock('viem/accounts', async () => {
  const actual = await vi.importActual<typeof import('viem/accounts')>('viem/accounts');
  return {
    ...actual,
    privateKeyToAccount: vi.fn(),
  };
});

vi.mock('../../../../src/utils/wallet', () => ({
  getWalletOrSigner: vi.fn(),
}));

vi.mock('../../../../src/utils', async (importOriginal) => {
  const originalUtils = await importOriginal<typeof import('../../../../src/utils')>();
  return {
    ...originalUtils,
    promptNetworkSelection: vi.fn(),
    promptWalletSelection: vi.fn(),
    getErrorMessage: vi.fn((e: any) => (e instanceof Error ? e.message : String(e))),
    getEtherscanAddress: vi.fn(() => 'https://sepolia.etherscan.io'),
  };
});

vi.mock('../../../../src/commands/gasless/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../src/commands/gasless/config')>();
  return {
    ...actual,
    getEip7702ImplementationAddress: vi.fn(),
    getGaslessRpcUrl: vi.fn(),
    getViemChain: vi.fn(),
  };
});

describe('gasless/admin/delegate-user', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    createWalletClientMock.mockImplementation(() => ({
      signAuthorization: signAuthorizationMock,
      sendTransaction: sendTransactionMock,
    }));

    const viemModule = await import('viem');
    (viemModule.http as MockedFunction<any>).mockReturnValue('http-transport');

    const utils = await import('../../../../src/utils');
    (utils.getErrorMessage as MockedFunction<any>).mockImplementation((e: any) =>
      e instanceof Error ? e.message : String(e),
    );
    (utils.getEtherscanAddress as MockedFunction<any>).mockReturnValue(
      'https://sepolia.etherscan.io',
    );

    const config = await import('../../../../src/commands/gasless/config');
    (config.getEip7702ImplementationAddress as MockedFunction<any>).mockReturnValue(
      '0xImplementationAddress00000000000000000000',
    );
    (config.getGaslessRpcUrl as MockedFunction<any>).mockReturnValue('https://rpc.example');
    (config.getViemChain as MockedFunction<any>).mockReturnValue({ id: 11155111 });
  });

  it('should delegate the user account via a standalone EIP-7702 authorization', async () => {
    const utils = await import('../../../../src/utils');
    (utils.promptNetworkSelection as MockedFunction<any>).mockResolvedValue('sepolia');
    (utils.promptWalletSelection as MockedFunction<any>).mockResolvedValue({
      encryptedWalletPath: './wallet.json',
    });

    const walletModule = await import('../../../../src/utils/wallet');
    (walletModule.getWalletOrSigner as MockedFunction<any>).mockResolvedValue({
      privateKey: '0xprivatekey00000000000000000000000000000000000000000000000000',
    });

    const accountsModule = await import('viem/accounts');
    const account = { address: '0xAccountAddress0000000000000000000000000' };
    (accountsModule.privateKeyToAccount as MockedFunction<any>).mockReturnValue(account);

    signAuthorizationMock.mockResolvedValue({ authorization: 'signed' });
    sendTransactionMock.mockResolvedValue('0xtxhash');

    const result = await handler();

    expect(createWalletClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        account,
        chain: { id: 11155111 },
        transport: 'http-transport',
      }),
    );
    expect(signAuthorizationMock).toHaveBeenCalledWith({
      contractAddress: '0xImplementationAddress00000000000000000000',
      executor: 'self',
    });
    expect(sendTransactionMock).toHaveBeenCalledWith({
      authorizationList: [{ authorization: 'signed' }],
      to: account.address,
      value: 0n,
    });
    expect(result).toBe('0xtxhash');

    const signale = await import('signale');
    expect(signale.success).toHaveBeenCalled();
  });

  it('should log an error and return undefined when the wallet has no private key', async () => {
    const utils = await import('../../../../src/utils');
    (utils.promptNetworkSelection as MockedFunction<any>).mockResolvedValue('sepolia');
    (utils.promptWalletSelection as MockedFunction<any>).mockResolvedValue({
      encryptedWalletPath: './wallet.json',
    });

    const walletModule = await import('../../../../src/utils/wallet');
    (walletModule.getWalletOrSigner as MockedFunction<any>).mockResolvedValue({});

    const result = await handler();

    expect(result).toBeUndefined();
    const signale = await import('signale');
    expect(signale.error).toHaveBeenCalledWith(
      expect.stringContaining('Delegating requires direct access to a private key'),
    );
    expect(createWalletClientMock).not.toHaveBeenCalled();
  });

  it('should log an error and return undefined for an unsupported network', async () => {
    const utils = await import('../../../../src/utils');
    (utils.promptNetworkSelection as MockedFunction<any>).mockResolvedValue('mainnet');

    const result = await handler();

    expect(result).toBeUndefined();
    expect(utils.promptWalletSelection).not.toHaveBeenCalled();
    const signale = await import('signale');
    expect(signale.error).toHaveBeenCalledWith(
      expect.stringMatching(/Gasless transactions are only supported on/),
    );
  });

  it('should log a non-Error rejection message', async () => {
    const utils = await import('../../../../src/utils');
    (utils.promptNetworkSelection as MockedFunction<any>).mockRejectedValue('boom');

    const result = await handler();

    expect(result).toBeUndefined();
    const signale = await import('signale');
    expect(signale.error).toHaveBeenCalledWith('boom');
  });
});
