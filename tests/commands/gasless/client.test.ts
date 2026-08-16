import { beforeEach, describe, expect, it, vi, MockedFunction } from 'vitest';
import { buildGaslessSmartAccountClient } from '../../../src/commands/gasless/client';

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

vi.mock('../../../src/commands/gasless/config', () => ({
  getGaslessRpcUrl: vi.fn(),
  getEip7702ImplementationAddress: vi.fn(),
  getPimlicoBundlerUrl: vi.fn(),
  getViemChain: vi.fn(),
  getPimlicoApiKey: vi.fn(),
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: vi.fn(),
  };
});

vi.mock('viem/accounts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem/accounts')>();
  return {
    ...actual,
    privateKeyToAccount: vi.fn(),
  };
});

vi.mock('viem/account-abstraction', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem/account-abstraction')>();
  return {
    ...actual,
    entryPoint08Address: '0xentrypoint08',
  };
});

vi.mock('permissionless/accounts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('permissionless/accounts')>();
  return {
    ...actual,
    to7702SimpleSmartAccount: vi.fn(),
  };
});

vi.mock('permissionless', async (importOriginal) => {
  const actual = await importOriginal<typeof import('permissionless')>();
  return {
    ...actual,
    createSmartAccountClient: vi.fn(),
  };
});

vi.mock('permissionless/clients/pimlico', async (importOriginal) => {
  const actual = await importOriginal<typeof import('permissionless/clients/pimlico')>();
  return {
    ...actual,
    createPimlicoClient: vi.fn(),
  };
});

const fakeChain = { id: 11155111, name: 'fake-chain' };
const fakePublicClient = { __brand: 'publicClient' };
const fakeOwner = { __brand: 'owner' };
const fakeSmartAccount = {
  address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};
const fakeSmartAccountClient = { __brand: 'smartAccountClient' };
const fakePimlicoGasPrice = {
  fast: { maxFeePerGas: 100n, maxPriorityFeePerGas: 10n },
};

describe('gasless/client', () => {
  let getGaslessRpcUrlMock: MockedFunction<any>;
  let getEip7702ImplementationAddressMock: MockedFunction<any>;
  let getPimlicoBundlerUrlMock: MockedFunction<any>;
  let getViemChainMock: MockedFunction<any>;
  let getPimlicoApiKeyMock: MockedFunction<any>;
  let createPublicClientMock: MockedFunction<any>;
  let privateKeyToAccountMock: MockedFunction<any>;
  let to7702SimpleSmartAccountMock: MockedFunction<any>;
  let createSmartAccountClientMock: MockedFunction<any>;
  let createPimlicoClientMock: MockedFunction<any>;
  let getUserOperationGasPriceMock: MockedFunction<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    const configModule = await import('../../../src/commands/gasless/config');
    getGaslessRpcUrlMock = configModule.getGaslessRpcUrl as MockedFunction<any>;
    getEip7702ImplementationAddressMock =
      configModule.getEip7702ImplementationAddress as MockedFunction<any>;
    getPimlicoBundlerUrlMock = configModule.getPimlicoBundlerUrl as MockedFunction<any>;
    getViemChainMock = configModule.getViemChain as MockedFunction<any>;
    getPimlicoApiKeyMock = configModule.getPimlicoApiKey as MockedFunction<any>;

    const viemModule = await import('viem');
    createPublicClientMock = viemModule.createPublicClient as MockedFunction<any>;

    const viemAccountsModule = await import('viem/accounts');
    privateKeyToAccountMock = viemAccountsModule.privateKeyToAccount as MockedFunction<any>;

    const permissionlessAccountsModule = await import('permissionless/accounts');
    to7702SimpleSmartAccountMock =
      permissionlessAccountsModule.to7702SimpleSmartAccount as MockedFunction<any>;

    const permissionlessModule = await import('permissionless');
    createSmartAccountClientMock =
      permissionlessModule.createSmartAccountClient as MockedFunction<any>;

    const pimlicoModule = await import('permissionless/clients/pimlico');
    createPimlicoClientMock = pimlicoModule.createPimlicoClient as MockedFunction<any>;

    getGaslessRpcUrlMock.mockReturnValue('https://fake-rpc.example.com');
    getEip7702ImplementationAddressMock.mockReturnValue(
      '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead',
    );
    getPimlicoBundlerUrlMock.mockReturnValue('https://fake-bundler.example.com');
    getViemChainMock.mockReturnValue(fakeChain);
    getPimlicoApiKeyMock.mockReturnValue('fake-api-key');

    createPublicClientMock.mockReturnValue(fakePublicClient);
    privateKeyToAccountMock.mockReturnValue(fakeOwner);
    to7702SimpleSmartAccountMock.mockResolvedValue(fakeSmartAccount);
    createSmartAccountClientMock.mockReturnValue(fakeSmartAccountClient);
    getUserOperationGasPriceMock = vi.fn().mockResolvedValue(fakePimlicoGasPrice);
    createPimlicoClientMock.mockReturnValue({
      getUserOperationGasPrice: getUserOperationGasPriceMock,
    });
  });

  it('builds a smart account client wired to the mocked collaborators', async () => {
    const result = await buildGaslessSmartAccountClient({
      network: 'sepolia' as any,
      privateKey: '0xprivatekey',
      paymasterAddress: '0xpaymaster0000000000000000000000000000000',
    });

    expect(to7702SimpleSmartAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: fakePublicClient,
        owner: fakeOwner,
        accountLogicAddress: '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead',
      }),
    );

    expect(createSmartAccountClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        account: fakeSmartAccount,
        chain: fakeChain,
      }),
    );

    expect(result).toEqual({
      smartAccountClient: fakeSmartAccountClient,
      smartAccountAddress: fakeSmartAccount.address,
    });
  });

  it('resolves paymaster stub/data with the given paymaster address and delegates fee estimation to the pimlico client', async () => {
    const paymasterAddress = '0xpaymaster0000000000000000000000000000000';

    await buildGaslessSmartAccountClient({
      network: 'sepolia' as any,
      privateKey: '0xprivatekey',
      paymasterAddress: paymasterAddress as `0x${string}`,
    });

    expect(createSmartAccountClientMock).toHaveBeenCalledTimes(1);
    const callArgs = createSmartAccountClientMock.mock.calls[0][0] as any;

    const stubData = await callArgs.paymaster.getPaymasterStubData();
    expect(stubData).toEqual(
      expect.objectContaining({
        paymaster: paymasterAddress,
      }),
    );

    const paymasterData = await callArgs.paymaster.getPaymasterData();
    expect(paymasterData).toEqual(
      expect.objectContaining({
        paymaster: paymasterAddress,
      }),
    );

    const estimatedFees = await callArgs.userOperation.estimateFeesPerGas();
    expect(estimatedFees).toBe(fakePimlicoGasPrice.fast);
    expect(getUserOperationGasPriceMock).toHaveBeenCalled();
  });

  it('passes the bundler url built from the mocked network and api key', async () => {
    await buildGaslessSmartAccountClient({
      network: 'amoy' as any,
      privateKey: '0xprivatekey',
      paymasterAddress: '0xpaymaster0000000000000000000000000000000',
    });

    expect(getPimlicoBundlerUrlMock).toHaveBeenCalledWith('amoy', 'fake-api-key');
    expect(createSmartAccountClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bundlerTransport: expect.anything(),
      }),
    );
  });
});
