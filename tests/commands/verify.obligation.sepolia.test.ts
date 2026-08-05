import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJsonFile } from '../../src/utils';
import { SignedVerifiableCredential } from '@trustvc/trustvc';

const OBLIGATION_FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/obligation');
const W3C_OBLIGATION_FIXTURE = path.join(
  OBLIGATION_FIXTURES_DIR,
  'w3c-obligation-record-sepolia.json',
);

describe('Obligation record (BoE) — Sepolia testnet verify', () => {
  // ─── W3C fixture structure (offline, no network) ──────────────────────────
  // No OA v2 equivalent: obligation / BoE records are W3C VC only.

  describe('W3C obligation record fixture (structural)', () => {
    it('fixture should be a W3C VC with an obligationRegistry credentialStatus', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(
        W3C_OBLIGATION_FIXTURE,
        'document',
      ) as any;
      expect(doc['@context']).toBeDefined();
      expect(doc.type).toContain('VerifiableCredential');
      expect(doc.credentialStatus.type).toBe('TransferableRecords');
      expect(doc.credentialStatus.obligationRegistry).toBeDefined();
      expect(doc.credentialStatus.tokenRegistry).toBeUndefined();
    });

    it('fixture should target Sepolia testnet (chainId 11155111)', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(
        W3C_OBLIGATION_FIXTURE,
        'document',
      ) as any;
      expect(doc.credentialStatus.tokenNetwork.chain).toBe('Sepolia');
      expect(doc.credentialStatus.tokenNetwork.chainId).toBe(11155111);
    });

    it('fixture should reference the correct obligation registry and token ID', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(
        W3C_OBLIGATION_FIXTURE,
        'document',
      ) as any;
      expect(doc.credentialStatus.obligationRegistry).toBe(
        '0xE8c7516BD4FC64DF039BAA586035dfaA57520BE4',
      );
      expect(doc.credentialStatus.tokenId).toBe(
        'd518e8958af67b90441775e4836feb050240ace87ac086d30496169ea296b32e',
      );
    });

    it('fixture issuer should be did:web:didhost.vercel.app', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(
        W3C_OBLIGATION_FIXTURE,
        'document',
      ) as any;
      expect(doc.issuer).toBe('did:web:didhost.vercel.app');
    });

    it('fixture should have a DataIntegrityProof', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(
        W3C_OBLIGATION_FIXTURE,
        'document',
      ) as any;
      expect(doc.proof.type).toBe('DataIntegrityProof');
    });
  });

  // ─── Network routing (no live RPC needed) ────────────────────────────────

  describe('network routing', () => {
    it('chainId 11155111 maps to NetworkCmdName.Sepolia', async () => {
      const { getSupportedNetworkNameFromId, getSupportedNetwork, NetworkCmdName } =
        await import('../../src/utils/networks');
      expect(getSupportedNetworkNameFromId(11155111)).toBe(NetworkCmdName.Sepolia);
      expect(getSupportedNetwork(NetworkCmdName.Sepolia)).toBeDefined();
    });

    it('SEPOLIA_RPC env var overrides the default Infura provider for Sepolia', async () => {
      const customRpc = 'https://sepolia.example.com/rpc';
      const originalSepoliaRpc = process.env.SEPOLIA_RPC;
      process.env.SEPOLIA_RPC = customRpc;

      try {
        const { getSupportedNetwork, NetworkCmdName } = await import('../../src/utils/networks');
        const { JsonRpcProvider } = await import('ethers');
        const provider = getSupportedNetwork(NetworkCmdName.Sepolia).provider();

        expect(provider).toBeInstanceOf(JsonRpcProvider);
        expect((provider as any)._getConnection?.().url ?? (provider as any).connection?.url).toBe(
          customRpc,
        );
      } finally {
        if (originalSepoliaRpc === undefined) {
          delete process.env.SEPOLIA_RPC;
        } else {
          process.env.SEPOLIA_RPC = originalSepoliaRpc;
        }
      }
    });
  });
});
