import path from 'node:path';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { verify } from '../../src/commands/verify';
import { readJsonFile } from '../../src/utils';
import { SignedVerifiableCredential } from '@trustvc/trustvc';

const POL_FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/pol');
const OA_POL_FIXTURE = path.join(POL_FIXTURES_DIR, 'oa-token-registry-pol-mainnet-v2.json');
const W3C_POL_FIXTURE = path.join(POL_FIXTURES_DIR, 'w3c-transferable-record-pol-mainnet.json');

// Live-network tests require real Polygon mainnet RPC.
// Run with: RUN_LIVE_TESTS=true npx vitest --run verify.pol
// Optionally set MATIC_RPC=https://polygon-bor-rpc.publicnode.com to avoid Infura rate limits.
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

describe('Polygon (POL) mainnet verify', () => {
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
  });

  describe('W3C transferable record fixture (structural)', () => {
    it('fixture should be a W3C VC with TransferableRecords credentialStatus', () => {
      const doc = readJsonFile<SignedVerifiableCredential>(W3C_POL_FIXTURE, 'document') as any;
      expect(doc['@context']).toBeDefined();
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
  });

  // ─── Network routing (no live RPC needed) ─────────────────────────────────

  describe('network routing', () => {
    it('OA doc: verify routes to matic network (chainId 137 → matic)', async () => {
      // Import networks util directly to confirm chain 137 maps to matic
      const { getSupportedNetworkNameFromId, getSupportedNetwork, NetworkCmdName } =
        await import('../../src/utils/networks');
      expect(getSupportedNetworkNameFromId(137)).toBe(NetworkCmdName.Matic);
      expect(getSupportedNetwork(NetworkCmdName.Matic)).toBeDefined();
    });

    it('MATIC_RPC env var overrides the default Infura provider for Polygon', async () => {
      const customRpc = 'https://polygon-bor-rpc.publicnode.com';
      process.env.MATIC_RPC = customRpc;

      const { getSupportedNetwork, NetworkCmdName } = await import('../../src/utils/networks');
      const { JsonRpcProvider } = await import('ethers');
      const network = getSupportedNetwork(NetworkCmdName.Matic);
      const provider = network.provider();

      delete process.env.MATIC_RPC;

      expect(provider).toBeInstanceOf(JsonRpcProvider);
      expect((provider as any)._getConnection?.().url ?? (provider as any).connection?.url).toBe(
        customRpc,
      );
    });
  });

  // ─── Live POL mainnet tests ────────────────────────────────────────────────

  describe.skipIf(!RUN_LIVE_TESTS)('live POL mainnet — OA token registry (minted)', () => {
    it(
      'should verify OA doc with VALID DOCUMENT_INTEGRITY and DOCUMENT_STATUS',
      { timeout: 60000 },
      async () => {
        const doc = readJsonFile<SignedVerifiableCredential>(OA_POL_FIXTURE, 'document');
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
        const doc = readJsonFile<SignedVerifiableCredential>(OA_POL_FIXTURE, 'document');
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

  describe.skipIf(!RUN_LIVE_TESTS)('live POL mainnet — W3C transferable record (minted)', () => {
    it(
      'should verify W3C doc with VALID DOCUMENT_INTEGRITY, DOCUMENT_STATUS, ISSUER_IDENTITY',
      { timeout: 60000 },
      async () => {
        const doc = readJsonFile<SignedVerifiableCredential>(W3C_POL_FIXTURE, 'document');
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
        const doc = readJsonFile<SignedVerifiableCredential>(W3C_POL_FIXTURE, 'document');
        await verify(doc);
        expect(signaleErrorMock).not.toHaveBeenCalled();
      },
    );
  });
});
