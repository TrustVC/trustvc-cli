import path from 'node:path';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { verify } from '../../src/commands/verify';
import { readJsonFile } from '../../src/utils';
import { SignedVerifiableCredential } from '@trustvc/trustvc';

const AMOY_FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/amoy');
const OA_AMOY_FIXTURE = path.join(AMOY_FIXTURES_DIR, 'oa-token-registry-amoy-testnet-v2.json');
const W3C_AMOY_FIXTURE = path.join(AMOY_FIXTURES_DIR, 'w3c-transferable-record-amoy-testnet.json');

// Live-network tests require real Polygon Amoy testnet RPC.
// Run with: RUN_LIVE_TESTS=true npx vitest --run verify.amoy
// Optionally set AMOY_RPC=https://rpc-amoy.polygon.technology/ to avoid Infura rate limits.
const RUN_LIVE_TESTS = !!process.env.RUN_LIVE_TESTS;

vi.mock('signale', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
  Signale: vi.fn().mockImplementation(() => ({
    await: vi.fn(),
    success: vi.fn(),
  })),
}));

describe('Polygon Amoy (testnet) verify', () => {
  let signaleSuccessMock: MockedFunction<any>;
  let signaleWarnMock: MockedFunction<any>;
  let signaleErrorMock: MockedFunction<any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const signale = await import('signale');
    signaleSuccessMock = (signale.default as any).success;
    signaleErrorMock = (signale.default as any).error;
    signaleWarnMock = (signale.default as any).warn;
  });

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

  // ─── Live Amoy testnet tests ──────────────────────────────────────────────

  describe.skipIf(!RUN_LIVE_TESTS)('live Amoy testnet — OA token registry (minted)', () => {
    it(
      'should verify OA doc with VALID DOCUMENT_INTEGRITY and DOCUMENT_STATUS',
      { timeout: 60000 },
      async () => {
        const doc = readJsonFile<SignedVerifiableCredential>(OA_AMOY_FIXTURE, 'document');
        await verify(doc);

        const successMessages = signaleSuccessMock.mock.calls.map((c: any[]) => c[0]);
        expect(successMessages).toContain('DOCUMENT_INTEGRITY: VALID');
        expect(successMessages).toContain('DOCUMENT_STATUS: VALID');
      },
    );

    it(
      'should log all three fragment types (INTEGRITY, STATUS, IDENTITY)',
      { timeout: 60000 },
      async () => {
        const doc = readJsonFile<SignedVerifiableCredential>(OA_AMOY_FIXTURE, 'document');
        await verify(doc);

        const allMessages = [
          ...signaleSuccessMock.mock.calls.map((c: any[]) => c[0]),
          ...signaleWarnMock.mock.calls.map((c: any[]) => c[0]),
          ...signaleErrorMock.mock.calls.map((c: any[]) => c[0]),
        ].join('\n');

        expect(allMessages).toContain('DOCUMENT_INTEGRITY:');
        expect(allMessages).toContain('DOCUMENT_STATUS:');
        expect(allMessages).toContain('ISSUER_IDENTITY:');
      },
    );
  });

  describe.skipIf(!RUN_LIVE_TESTS)('live Amoy testnet — W3C transferable record (minted)', () => {
    it(
      'should verify W3C doc with VALID DOCUMENT_INTEGRITY, DOCUMENT_STATUS, ISSUER_IDENTITY',
      { timeout: 60000 },
      async () => {
        const doc = readJsonFile<SignedVerifiableCredential>(W3C_AMOY_FIXTURE, 'document');
        await verify(doc);

        const successMessages = signaleSuccessMock.mock.calls.map((c: any[]) => c[0]);
        expect(successMessages).toContain('DOCUMENT_INTEGRITY: VALID');
        expect(successMessages).toContain('DOCUMENT_STATUS: VALID');
        expect(successMessages).toContain('ISSUER_IDENTITY: VALID');
      },
    );

    it(
      'should not log any ERROR level messages for a valid minted W3C doc',
      { timeout: 60000 },
      async () => {
        const doc = readJsonFile<SignedVerifiableCredential>(W3C_AMOY_FIXTURE, 'document');
        await verify(doc);
        expect(signaleErrorMock).not.toHaveBeenCalled();
      },
    );
  });
});
