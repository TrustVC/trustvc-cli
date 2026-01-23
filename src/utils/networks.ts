import { InfuraProvider, JsonRpcProvider, Provider } from 'ethers';
import type { GasStationFunction } from './gas-station';
import { SUPPORTED_CHAINS, CHAIN_ID } from '@trustvc/trustvc';

// Re-export for use in other modules
export { SUPPORTED_CHAINS, CHAIN_ID };

export type networkCurrency = 'ETH' | 'MATIC' | 'XDC' | 'FREE' | 'ASTRON';

type SupportedNetwork = {
  explorer: string;
  provider: () => Provider;
  networkId: number;
  networkName: (typeof NetworkCmdName)[keyof typeof NetworkCmdName];
  currency: networkCurrency;
  gasStation?: ReturnType<GasStationFunction>;
};

export enum NetworkCmdName {
  Local = 'local',
  Mainnet = 'mainnet',
  Sepolia = 'sepolia',
  Matic = 'matic',
  Amoy = 'amoy',
  XDC = 'xdc',
  XDCApothem = 'xdcapothem',
  StabilityTestnet = 'stabilitytestnet',
  Stability = 'stability',
  Astron = 'astron',
  AstronTestnet = 'astrontestnet',
}

const defaultInfuraProvider =
  (networkName: string): (() => Provider) =>
  () =>
    new InfuraProvider(networkName);

const jsonRpcProvider =
  (url: string): (() => Provider) =>
  () =>
    new JsonRpcProvider(url);

/**
 * Creates a provider that checks for an environment variable override
 * before falling back to the default provider.
 * Environment variable format: {NETWORK_NAME}_RPC
 * Example: SEPOLIA_RPC=https://sepolia.infura.io/v3/your-key
 */
const getProviderWithEnvOverride =
  (networkName: NetworkCmdName, defaultProvider: () => Provider): (() => Provider) =>
  () => {
    const envVarName = `${networkName.toUpperCase()}_RPC`;
    const customRpcUrl = process.env[envVarName];

    if (customRpcUrl) {
      return new JsonRpcProvider(customRpcUrl);
    }

    return defaultProvider();
  };

// RPC URL mapping for each network (used for provider creation)
const rpcUrls: { [key in NetworkCmdName]: string } = {
  [NetworkCmdName.Local]: 'http://127.0.0.1:8545',
  [NetworkCmdName.Mainnet]: 'homestead', // Special case for Infura
  [NetworkCmdName.Sepolia]: 'sepolia', // Special case for Infura
  [NetworkCmdName.Matic]: 'matic',
  [NetworkCmdName.Amoy]: 'matic-amoy',
  [NetworkCmdName.XDC]: 'https://rpc.ankr.com/xdc',
  [NetworkCmdName.XDCApothem]: 'https://rpc.apothem.network',
  [NetworkCmdName.Stability]: 'https://rpc.stabilityprotocol.com/zgt/tradeTrust',
  [NetworkCmdName.StabilityTestnet]: 'https://rpc.testnet.stabilityprotocol.com/zgt/tradeTrust',
  [NetworkCmdName.Astron]: 'https://astronlayer2.bitfactory.cn/rpc/',
  [NetworkCmdName.AstronTestnet]: 'https://dev-astronlayer2.bitfactory.cn/query/',
};

// Create provider based on network type
const createProvider = (networkName: NetworkCmdName): (() => Provider) => {
  const rpcUrl = rpcUrls[networkName];

  // Use Infura provider for mainnet and sepolia
  if (
    networkName === NetworkCmdName.Mainnet ||
    networkName === NetworkCmdName.Sepolia ||
    networkName === NetworkCmdName.Matic ||
    networkName === NetworkCmdName.Amoy
  ) {
    return getProviderWithEnvOverride(networkName, defaultInfuraProvider(rpcUrl));
  }

  // Use JSON RPC provider for all other networks
  return getProviderWithEnvOverride(networkName, jsonRpcProvider(rpcUrl));
};

// Build supportedNetwork from SUPPORTED_CHAINS and add providers
const buildSupportedNetwork = (): { [key in NetworkCmdName]: SupportedNetwork } => {
  const networks: Partial<{ [key in NetworkCmdName]: SupportedNetwork }> = {};

  // Map SUPPORTED_CHAINS to our network structure
  Object.entries(SUPPORTED_CHAINS).forEach(([chainId, chainConfig]) => {
    const networkName = chainConfig.name as NetworkCmdName;

    // Only process networks that are in our NetworkCmdName enum
    if (Object.values(NetworkCmdName).includes(networkName)) {
      networks[networkName] = {
        explorer: chainConfig.explorerUrl,
        provider: createProvider(networkName),
        networkId: Number(chainId),
        networkName: networkName,
        currency: chainConfig.currency as networkCurrency,
        gasStation: chainConfig.gasStation as ReturnType<GasStationFunction> | undefined,
      };
    }
  });

  return networks as { [key in NetworkCmdName]: SupportedNetwork };
};

export const supportedNetwork: {
  [key in NetworkCmdName]: SupportedNetwork;
} = buildSupportedNetwork();

export const getSupportedNetwork = (networkCmdName: string): SupportedNetwork => {
  return supportedNetwork[networkCmdName as NetworkCmdName];
};

export const getSupportedNetworkNameFromId = (
  networkId: number,
): SupportedNetwork['networkName'] => {
  const network = Object.values(supportedNetwork).find(
    (network) => network.networkId === networkId,
  );
  if (!network) {
    throw new Error(`Unsupported chain id ${networkId}`);
  }
  return network.networkName;
};
