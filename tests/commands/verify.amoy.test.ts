import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJsonFile } from '../../src/utils';
import { SignedVerifiableCredential } from '@trustvc/trustvc';

const AMOY_FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/amoy');
const OA_AMOY_FIXTURE = path.join(AMOY_FIXTURES_DIR, 'oa-token-registry-amoy-testnet-v2.json');
const W3C_AMOY_FIXTURE = path.join(AMOY_FIXTURES_DIR, 'w3c-transferable-record-amoy-testnet.json');

describe('Polygon Amoy (testnet) verify', () => {
  // ─── OA v2 fixture structure (offline, no network) ───────────────────────

  describe('OA v2 token registry fixture (structural)', () => {
    it('fixture should be a valid wrapped OA v2 document', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(OA_AMOY_FIXTURE, 'document');
      expect((doc as any).version).toBe('https://schema.openattestation.com/2.0/schema.json');
      expect((doc as any).signature).toBeDefined();
      expect((doc as any).signature.type).toBe('SHA3MerkleProof');
    });

    it('fixture should target Polygon Amoy testnet (chainId 80002)', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(OA_AMOY_FIXTURE, 'document') as any;
      // data.network.chainId is UUID-encoded in wrapped OA v2
      expect(doc.data.network.chainId).toContain('80002');
    });

    it('fixture should reference the correct Amoy token registry', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(OA_AMOY_FIXTURE, 'document') as any;
      expect(doc.data.issuers[0].tokenRegistry).toContain(
        '0xa5f9a7106a599E4caAFacE6872da097aa802Cc64',
      );
    });

    it('fixture should have a valid SHA3MerkleProof signature with non-empty targetHash', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(OA_AMOY_FIXTURE, 'document') as any;
      expect(doc.signature.targetHash).toMatch(/^[a-f0-9]{64}$/);
      expect(doc.signature.merkleRoot).toBe(doc.signature.targetHash);
    });
  });

  // ─── W3C fixture structure (offline, no network) ──────────────────────────

  describe('W3C transferable record fixture (structural)', () => {
    it('fixture should be a W3C VC with TransferableRecords credentialStatus', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(W3C_AMOY_FIXTURE, 'document') as any;
      expect(doc['@context']).toBeDefined();
      expect(doc.type).toContain('VerifiableCredential');
      expect(doc.credentialStatus.type).toBe('TransferableRecords');
    });

    it('fixture should target Polygon Amoy testnet (chain POL, chainId 80002)', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(W3C_AMOY_FIXTURE, 'document') as any;
      expect(doc.credentialStatus.tokenNetwork.chain).toBe('POL');
      expect(doc.credentialStatus.tokenNetwork.chainId).toBe(80002);
    });

    it('fixture should reference the correct Amoy token registry and token ID', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(W3C_AMOY_FIXTURE, 'document') as any;
      expect(doc.credentialStatus.tokenRegistry).toBe('0xa5f9a7106a599E4caAFacE6872da097aa802Cc64');
      expect(doc.credentialStatus.tokenId).toBe(
        'd320d1e7eaf6a0f9ec185c8b25470d027115ef2059e5b1bcb41cde09f799be75',
      );
    });

    it('fixture issuer should be did:web:trustvc.github.io:did:1', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(W3C_AMOY_FIXTURE, 'document') as any;
      expect(doc.issuer).toBe('did:web:trustvc.github.io:did:1');
    });

    it('fixture should have a DataIntegrityProof', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(W3C_AMOY_FIXTURE, 'document') as any;
      expect(doc.proof.type).toBe('DataIntegrityProof');
    });
  });

  // ─── Network routing (no live RPC needed) ────────────────────────────────

  describe('network routing', () => {
    it('chainId 80002 maps to NetworkCmdName.Amoy', async () => {
      const { getSupportedNetworkNameFromId, getSupportedNetwork, NetworkCmdName } =
        await import('../../src/utils/networks');
      expect(getSupportedNetworkNameFromId(80002)).toBe(NetworkCmdName.Amoy);
      expect(getSupportedNetwork(NetworkCmdName.Amoy)).toBeDefined();
    });

    it('AMOY_RPC env var overrides the default Infura provider for Polygon Amoy', async () => {
      const customRpc = 'https://rpc-amoy.polygon.technology/';
      process.env.AMOY_RPC = customRpc;

      const { getSupportedNetwork, NetworkCmdName } = await import('../../src/utils/networks');
      const { JsonRpcProvider } = await import('ethers');
      const network = getSupportedNetwork(NetworkCmdName.Amoy);
      const provider = network.provider();

      delete process.env.AMOY_RPC;

      expect(provider).toBeInstanceOf(JsonRpcProvider);
      expect((provider as any)._getConnection?.().url ?? (provider as any).connection?.url).toBe(
        customRpc,
      );
    });
  });
});
