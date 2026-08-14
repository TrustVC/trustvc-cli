import { createPublicClient, Hex, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { entryPoint08Address } from 'viem/account-abstraction';
import { to7702SimpleSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import {
  GaslessSupportedNetwork,
  getEip7702ImplementationAddress,
  getGaslessRpcUrl,
  getPimlicoApiKey,
  getPimlicoBundlerUrl,
  getViemChain,
} from './config';

/**
 * Minimal client shape required by @trustvc/trustvc's `*Gasless` functions: given the raw
 * call, sign and submit a sponsored UserOperation and resolve once it has been mined.
 */
export interface GaslessSmartAccountClient {
  sendTransaction(args: {
    to: `0x${string}`;
    value: bigint;
    data: `0x${string}`;
  }): Promise<`0x${string}`>;
}

export interface BuildGaslessSmartAccountClientArgs {
  network: GaslessSupportedNetwork;
  /** Raw private key (hex) of the current holder/beneficiary EOA that will delegate via EIP-7702. */
  privateKey: string;
  paymasterAddress: `0x${string}`;
}

export interface GaslessSmartAccountClientResult {
  smartAccountClient: GaslessSmartAccountClient;
  smartAccountAddress: `0x${string}`;
}

// Conservative stub limits used while the bundler estimates gas for the sponsored UserOperation.
const PAYMASTER_VERIFICATION_GAS_LIMIT = 150_000n;
const PAYMASTER_POST_OP_GAS_LIMIT = 50_000n;

/**
 * Builds an EIP-7702 smart account client (holder's EOA delegated to the deployed
 * EIP7702Implementation contract) wired to Pimlico's bundler, with gas sponsored on-chain by the
 * PlatformPaymaster at `paymasterAddress`.
 */
export const buildGaslessSmartAccountClient = async ({
  network,
  privateKey,
  paymasterAddress,
}: BuildGaslessSmartAccountClientArgs): Promise<GaslessSmartAccountClientResult> => {
  const chain = getViemChain(network);
  const rpcUrl = getGaslessRpcUrl(network);
  const implementationAddress = getEip7702ImplementationAddress(network);
  const bundlerUrl = getPimlicoBundlerUrl(network, getPimlicoApiKey());

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const owner = privateKeyToAccount(privateKey as Hex);

  const smartAccount = await to7702SimpleSmartAccount({
    client: publicClient,
    owner,
    accountLogicAddress: implementationAddress,
  });

  const pimlicoClient = createPimlicoClient({
    transport: http(bundlerUrl),
    entryPoint: { address: entryPoint08Address, version: '0.8' },
  });

  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: {
      getPaymasterStubData: async () => ({
        paymaster: paymasterAddress,
        paymasterData: '0x',
        paymasterVerificationGasLimit: PAYMASTER_VERIFICATION_GAS_LIMIT,
        paymasterPostOpGasLimit: PAYMASTER_POST_OP_GAS_LIMIT,
      }),
      getPaymasterData: async () => ({
        paymaster: paymasterAddress,
        paymasterData: '0x',
      }),
    },
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  return {
    smartAccountClient,
    smartAccountAddress: smartAccount.address,
  };
};
