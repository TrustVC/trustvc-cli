/**
 * Shared constants for document-store tests
 * Import these in your test files to avoid duplication
 */

export const SUPPORTED_CHAINS = {
  1: {
    name: 'mainnet',
    explorerUrl: 'https://etherscan.io',
    rpcUrl: 'https://mainnet.infura.io/v3/test',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  11155111: {
    name: 'sepolia',
    explorerUrl: 'https://sepolia.etherscan.io',
    rpcUrl: 'https://sepolia.infura.io/v3/test',
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
  },
  137: {
    name: 'matic',
    explorerUrl: 'https://polygonscan.com',
    rpcUrl: 'https://polygon-mainnet.infura.io/v3/test',
    nativeCurrency: { symbol: 'MATIC', decimals: 18 },
  },
  80002: {
    name: 'amoy',
    explorerUrl: 'https://www.oklink.com/amoy',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    nativeCurrency: { symbol: 'MATIC', decimals: 18 },
  },
  50: {
    name: 'xdc',
    explorerUrl: 'https://xdcscan.io',
    rpcUrl: 'https://rpc.ankr.com/xdc',
    nativeCurrency: { symbol: 'XDC', decimals: 18 },
  },
  51: {
    name: 'xdcapothem',
    explorerUrl: 'https://apothem.xdcscan.io',
    rpcUrl: 'https://rpc.apothem.network',
    nativeCurrency: { symbol: 'XDC', decimals: 18 },
  },
  101010: {
    name: 'stability',
    explorerUrl: 'https://stability.blockscout.com',
    rpcUrl: 'https://rpc.stabilityprotocol.com/zgt/tradeTrust',
    nativeCurrency: { symbol: 'FREE', decimals: 18 },
  },
  20180427: {
    name: 'stabilitytestnet',
    explorerUrl: 'https://stability-testnet.blockscout.com/',
    rpcUrl: 'https://rpc.testnet.stabilityprotocol.com/zgt/tradeTrust',
    nativeCurrency: { symbol: 'FREE', decimals: 18 },
  },
  1338: {
    name: 'astron',
    explorerUrl: 'https://astronscanl2.bitfactory.cn/',
    rpcUrl: 'https://astronlayer2.bitfactory.cn/query/',
    nativeCurrency: { symbol: 'ASTRON', decimals: 18 },
  },
  21002: {
    name: 'astrontestnet',
    explorerUrl: 'https://dev-astronscanl2.bitfactory.cn/',
    rpcUrl: 'https://dev-astronlayer2.bitfactory.cn/query/',
    nativeCurrency: { symbol: 'ASTRON', decimals: 18 },
  },
};

export const CHAIN_ID = {
  mainnet: 1,
  sepolia: 11155111,
  matic: 137,
  amoy: 80002,
  xdc: 50,
  xdcapothem: 51,
  stability: 101010,
  stabilitytestnet: 20180427,
  astron: 1338,
  astrontestnet: 21002,
};
