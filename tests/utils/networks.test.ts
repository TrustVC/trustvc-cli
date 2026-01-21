import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSupportedNetwork, NetworkCmdName } from '../../src/utils/networks';
import { JsonRpcProvider } from 'ethers';

describe('networks', () => {
  describe('environment variable RPC override', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset process.env before each test
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      // Restore original process.env after each test
      process.env = originalEnv;
    });

    it('should use custom RPC when SEPOLIA_RPC is set', () => {
      const customRpc = 'https://custom-sepolia.example.com';
      process.env.SEPOLIA_RPC = customRpc;

      const network = getSupportedNetwork(NetworkCmdName.Sepolia);
      const provider = network.provider();

      // Check that the provider is using the custom RPC
      expect(provider).toBeInstanceOf(JsonRpcProvider);
      expect((provider as any)._getConnection().url).toBe(customRpc);
    });

    it('should use default RPC when no environment variable is set', () => {
      delete process.env.SEPOLIA_RPC;

      const network = getSupportedNetwork(NetworkCmdName.Sepolia);
      const provider = network.provider();

      // The default provider from SUPPORTED_CHAINS should be used (JsonRpcProvider)
      expect(provider).toBeInstanceOf(JsonRpcProvider);
    });

    it('should use custom RPC for MAINNET_RPC', () => {
      const customRpc = 'https://custom-mainnet.example.com';
      process.env.MAINNET_RPC = customRpc;

      const network = getSupportedNetwork(NetworkCmdName.Mainnet);
      const provider = network.provider();

      expect(provider).toBeInstanceOf(JsonRpcProvider);
      expect((provider as any)._getConnection().url).toBe(customRpc);
    });

    it('should use custom RPC for AMOY_RPC', () => {
      const customRpc = 'https://custom-amoy.example.com';
      process.env.AMOY_RPC = customRpc;

      const network = getSupportedNetwork(NetworkCmdName.Amoy);
      const provider = network.provider();

      expect(provider).toBeInstanceOf(JsonRpcProvider);
      expect((provider as any)._getConnection().url).toBe(customRpc);
    });

    it('should use custom RPC for LOCAL_RPC', () => {
      const customRpc = 'http://localhost:9545';
      process.env.LOCAL_RPC = customRpc;

      const network = getSupportedNetwork(NetworkCmdName.Local);
      const provider = network.provider();

      expect(provider).toBeInstanceOf(JsonRpcProvider);
      expect((provider as any)._getConnection().url).toBe(customRpc);
    });

    it('should handle multiple custom RPCs independently', () => {
      const customSepoliaRpc = 'https://custom-sepolia.example.com';
      const customMainnetRpc = 'https://custom-mainnet.example.com';

      process.env.SEPOLIA_RPC = customSepoliaRpc;
      process.env.MAINNET_RPC = customMainnetRpc;

      const sepoliaNetwork = getSupportedNetwork(NetworkCmdName.Sepolia);
      const sepoliaProvider = sepoliaNetwork.provider();

      const mainnetNetwork = getSupportedNetwork(NetworkCmdName.Mainnet);
      const mainnetProvider = mainnetNetwork.provider();

      expect(sepoliaProvider).toBeInstanceOf(JsonRpcProvider);
      expect((sepoliaProvider as any)._getConnection().url).toBe(customSepoliaRpc);
      expect(mainnetProvider).toBeInstanceOf(JsonRpcProvider);
      expect((mainnetProvider as any)._getConnection().url).toBe(customMainnetRpc);
    });

    it('should use default for one network and custom for another', () => {
      const customSepoliaRpc = 'https://custom-sepolia.example.com';
      process.env.SEPOLIA_RPC = customSepoliaRpc;
      delete process.env.MAINNET_RPC;

      const sepoliaNetwork = getSupportedNetwork(NetworkCmdName.Sepolia);
      const sepoliaProvider = sepoliaNetwork.provider();

      const mainnetNetwork = getSupportedNetwork(NetworkCmdName.Mainnet);
      const mainnetProvider = mainnetNetwork.provider();

      expect(sepoliaProvider).toBeInstanceOf(JsonRpcProvider);
      expect((sepoliaProvider as any)._getConnection().url).toBe(customSepoliaRpc);
      // Default provider from SUPPORTED_CHAINS for mainnet (JsonRpcProvider)
      expect(mainnetProvider).toBeInstanceOf(JsonRpcProvider);
    });
  });
});
