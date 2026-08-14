import { Chain } from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
import { gaslessConstants } from '@trustvc/trustvc';
import { NetworkCmdName } from '../../utils';

/**
 * Gasless (EIP-7702 + Pimlico sponsored) transactions depend on a PlatformPaymaster and an
 * EIP7702Implementation contract being deployed on the target chain. Today those are only
 * deployed on Sepolia and Amoy, so gasless support is intentionally limited to these networks.
 */
export const GASLESS_SUPPORTED_NETWORKS = [NetworkCmdName.Sepolia, NetworkCmdName.Amoy] as const;

export type GaslessSupportedNetwork = (typeof GASLESS_SUPPORTED_NETWORKS)[number];

export const isGaslessSupportedNetwork = (network: string): network is GaslessSupportedNetwork =>
  (GASLESS_SUPPORTED_NETWORKS as readonly string[]).includes(network);

export const assertGaslessSupportedNetwork = (network: string): GaslessSupportedNetwork => {
  if (!isGaslessSupportedNetwork(network)) {
    throw new Error(
      `Gasless transactions are only supported on: ${GASLESS_SUPPORTED_NETWORKS.join(', ')}. ` +
        `The document resolved to network "${network}", which is not supported. Re-run without --gasless to send a regular transaction.`,
    );
  }
  return network;
};

const VIEM_CHAIN: Record<GaslessSupportedNetwork, Chain> = {
  [NetworkCmdName.Sepolia]: sepolia,
  [NetworkCmdName.Amoy]: polygonAmoy,
};

export const getViemChain = (network: GaslessSupportedNetwork): Chain => VIEM_CHAIN[network];

const DEFAULT_RPC_URL: Record<GaslessSupportedNetwork, string> = {
  [NetworkCmdName.Sepolia]: 'https://ethereum-sepolia-rpc.publicnode.com',
  [NetworkCmdName.Amoy]: 'https://polygon-amoy-bor-rpc.publicnode.com',
};

/** Reads the Pimlico API key from the environment. Required for every gasless transaction. */
export const getPimlicoApiKey = (): string => {
  const apiKey = process.env.PIMLICO_API_KEY;
  if (!apiKey) {
    throw new Error(
      'PIMLICO_API_KEY environment variable is required for gasless transactions. ' +
        'Get an API key from https://dashboard.pimlico.io and set it in your environment.',
    );
  }
  return apiKey;
};

/**
 * Reads the deployed EIP7702Implementation contract address for the given network from the
 * environment. Checked first as `{NETWORK}_EIP7702_IMPL_ADDRESS`, falling back to the generic
 * `EIP7702_IMPL_ADDRESS` if set.
 */
export const getEip7702ImplementationAddress = (
  network: GaslessSupportedNetwork,
): `0x${string}` => {
  const scopedEnvVar = `${network.toUpperCase()}_EIP7702_IMPL_ADDRESS`;
  const address = process.env[scopedEnvVar] || process.env.EIP7702_IMPL_ADDRESS;

  if (!address) {
    throw new Error(
      `Missing EIP-7702 implementation address for ${network}. Set the ${scopedEnvVar} ` +
        `(or generic EIP7702_IMPL_ADDRESS) environment variable to the deployed EIP7702Implementation contract address.`,
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(
      `Invalid EIP-7702 implementation address in ${scopedEnvVar}/EIP7702_IMPL_ADDRESS: ${address}`,
    );
  }

  return address as `0x${string}`;
};

/** RPC URL used for gasless reads/client setup, overridable via `{NETWORK}_RPC`. */
export const getGaslessRpcUrl = (network: GaslessSupportedNetwork): string => {
  const scopedEnvVar = `${network.toUpperCase()}_RPC`;
  return process.env[scopedEnvVar] || DEFAULT_RPC_URL[network];
};

// Pimlico's v2 bundler/paymaster endpoint accepts a chain identifier segment; the numeric chain
// ID is used here (rather than a hand-maintained slug table) since it works for any chain and
// never goes stale as Pimlico adds/renames network slugs.
export const getPimlicoBundlerUrl = (network: GaslessSupportedNetwork, apiKey: string): string =>
  `https://api.pimlico.io/v2/${getViemChain(network).id}/rpc?apikey=${apiKey}`;

/**
 * viem's HTTP/RPC/timeout errors embed the request URL verbatim in their message (it only strips
 * basic-auth credentials, not query params), so a bundler network error would otherwise leak the
 * `apikey` query value from `getPimlicoBundlerUrl` straight into command-handler logs. Strips it
 * from arbitrary error text before logging.
 */
export const redactPimlicoApiKey = (message: string): string => {
  const apiKey = process.env.PIMLICO_API_KEY;
  return apiKey ? message.split(apiKey).join('[REDACTED]') : message;
};

/**
 * PlatformAccountFactory address for the given network, from @trustvc/trustvc's own
 * `gaslessConstants`. Deliberately not left for `deployPlatformPaymaster` to default itself —
 * its internal fallback (`@trustvc/eip7702`'s bundled constants) is stale for Sepolia and has no
 * entry at all for Amoy. Looked up lazily (not at module load) so this file stays importable
 * even against a partial `@trustvc/trustvc` mock that doesn't stub `gaslessConstants`.
 */
export const getGaslessFactoryAddress = (network: GaslessSupportedNetwork): `0x${string}` => {
  const factoryAddress: Record<GaslessSupportedNetwork, string> = {
    [NetworkCmdName.Sepolia]: gaslessConstants.GASLESS_FACTORY_ADDRESS_SEPOLIA,
    [NetworkCmdName.Amoy]: gaslessConstants.GASLESS_FACTORY_ADDRESS_AMOY,
  };

  const address = factoryAddress[network];
  if (!address) {
    throw new Error(
      `Missing gasless factory address for ${network} in @trustvc/trustvc's gaslessConstants. ` +
        `This indicates an incompatible @trustvc/trustvc version — check for a package update.`,
    );
  }

  return address as `0x${string}`;
};
