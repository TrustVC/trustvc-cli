import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJsonFile } from '../../src/utils';
import { SignedVerifiableCredential } from '@trustvc/trustvc';

const POL_FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/pol');
const OA_POL_FIXTURE = path.join(POL_FIXTURES_DIR, 'oa-token-registry-pol-mainnet-v2.json');
const W3C_POL_FIXTURE = path.join(POL_FIXTURES_DIR, 'w3c-transferable-record-pol-mainnet.json');

describe('Polygon (POL) mainnet verify', () => {
  // ─── Fixture structure (offline, no network) ──────────────────────────────

  describe('OA v2 token registry fixture (structural)', () => {
    it('fixture should be a valid wrapped OA v2 document', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(OA_POL_FIXTURE, 'document');
      expect((doc as any).version).toBe('https://schema.openattestation.com/2.0/schema.json');
      expect((doc as any).signature).toBeDefined();
      expect((doc as any).signature.type).toBe('SHA3MerkleProof');
    });

    it('fixture should target POL mainnet (chainId 137)', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(OA_POL_FIXTURE, 'document') as any;
      // data.network.chainId is UUID-encoded in wrapped OA v2
      expect((doc as any).data.network.chainId).toContain('137');
    });

    it('fixture should reference correct token registry', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(OA_POL_FIXTURE, 'document') as any;
      expect(doc.data.issuers[0].tokenRegistry).toContain(
        '0x0961d9C2dA9a7105fDFC9DC4ec45951C024F88B0',
      );
    });

    it('fixture should have a valid SHA3MerkleProof signature with non-empty targetHash', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(OA_POL_FIXTURE, 'document') as any;
      expect(doc.signature.targetHash).toMatch(/^[a-f0-9]{64}$/);
      expect(doc.signature.merkleRoot).toBe(doc.signature.targetHash);
    });
  });

  describe('W3C transferable record fixture (structural)', () => {
    it('fixture should be a W3C VC with TransferableRecords credentialStatus', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(W3C_POL_FIXTURE, 'document') as any;
      expect(doc['@context']).toBeDefined();
      expect(doc.type).toContain('VerifiableCredential');
      expect(doc.credentialStatus.type).toBe('TransferableRecords');
    });

    it('fixture should target POL mainnet (chainId 137)', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(W3C_POL_FIXTURE, 'document') as any;
      expect(doc.credentialStatus.tokenNetwork.chain).toBe('POL');
      expect(doc.credentialStatus.tokenNetwork.chainId).toBe(137);
    });

    it('fixture should reference correct token registry and token ID', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(W3C_POL_FIXTURE, 'document') as any;
      expect(doc.credentialStatus.tokenRegistry).toBe('0x0961d9C2dA9a7105fDFC9DC4ec45951C024F88B0');
      expect(doc.credentialStatus.tokenId).toBe(
        '1174afa500e1b265450b55200cb16487e92e7c5410cff84b693eda59194b10fd',
      );
    });

    it('fixture issuer should be did:web:trustvc.github.io:did:1', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(W3C_POL_FIXTURE, 'document') as any;
      expect(doc.issuer).toBe('did:web:trustvc.github.io:did:1');
    });

    it('fixture should have a DataIntegrityProof', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(W3C_POL_FIXTURE, 'document') as any;
      expect(doc.proof.type).toBe('DataIntegrityProof');
    });
  });

  // ─── Network routing (no live RPC needed) ─────────────────────────────────

  describe('network routing', () => {
    it('chainId 137 maps to NetworkCmdName.Pol', async () => {
      const { getSupportedNetworkNameFromId, NetworkCmdName } =
        await import('../../src/utils/networks');
      expect(getSupportedNetworkNameFromId(137)).toBe(NetworkCmdName.Pol);
    });

    it('getSupportedNetwork returns Polygon config for NetworkCmdName.Pol', async () => {
      const { getSupportedNetwork, NetworkCmdName } = await import('../../src/utils/networks');
      const polNetwork = getSupportedNetwork(NetworkCmdName.Pol);
      expect(polNetwork).toBeDefined();
      expect(polNetwork.networkId).toBe(137);
      expect(polNetwork.currency).toBe('POL');
    });

    it('POL_RPC env var overrides the default Infura provider for Polygon', async () => {
      const customRpc = 'https://polygon-bor-rpc.publicnode.com';
      process.env.POL_RPC = customRpc;

      const { getSupportedNetwork, NetworkCmdName } = await import('../../src/utils/networks');
      const { JsonRpcProvider } = await import('ethers');
      const provider = getSupportedNetwork(NetworkCmdName.Pol).provider();

      delete process.env.POL_RPC;

      expect(provider).toBeInstanceOf(JsonRpcProvider);
      expect((provider as any)._getConnection?.().url ?? (provider as any).connection?.url).toBe(
        customRpc,
      );
    });
  });
});
