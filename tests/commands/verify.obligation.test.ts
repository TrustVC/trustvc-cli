import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObligationDocumentStatus, ObligationEscrowTerminationReason } from '@trustvc/trustvc';
import { getObligationDocumentStatus, verify } from '../../src/commands/verify';

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

const verifyDocumentMock = vi.fn();

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    verifyDocument: (...args: unknown[]) => verifyDocumentMock(...args),
    isObligationRecord: vi.fn(() => true),
    isTransferableRecord: vi.fn(() => false),
    isDocumentRevokable: vi.fn(() => false),
    isWrappedV2Document: vi.fn(() => false),
    isWrappedV3Document: vi.fn(() => false),
    getChainId: vi.fn(() => 80002),
  };
});

vi.mock('../../src/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils')>();
  return {
    ...actual,
    getSupportedNetworkNameFromId: vi.fn(() => 'amoy'),
    getSupportedNetwork: vi.fn(() => ({
      provider: () => ({ getNetwork: async () => ({ chainId: 80002 }) }),
    })),
    CaptureConsoleWarn: (fn: () => unknown) => ({ result: fn(), warnings: null }),
    CaptureConsoleWarnAsync: async (fn: () => Promise<unknown>) => ({
      result: await fn(),
      warnings: null,
    }),
  };
});

const shreddedObligationFragments = [
  { type: 'DOCUMENT_INTEGRITY', name: 'W3CSignatureIntegrity', status: 'VALID' },
  {
    type: 'DOCUMENT_STATUS',
    name: 'ObligationRecords',
    status: 'VALID',
    data: {
      obligationRegistry: '0xRegistry',
      // Reject/discharge/accept-return burns to 0xdEaD; SDK still reports minted (VALID),
      // same as classic ETR shredded titles.
      status: ObligationDocumentStatus.Rejected,
      terminationReason: ObligationEscrowTerminationReason.Rejected,
    },
  },
  { type: 'ISSUER_IDENTITY', name: 'W3CIssuerIdentity', status: 'VALID' },
];

describe('verify obligation / BoE (shredded titles)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyDocumentMock.mockResolvedValue(shreddedObligationFragments);
  });

  describe('getObligationDocumentStatus', () => {
    it('returns registry status for VALID ObligationRecords after shred (rejected)', () => {
      expect(getObligationDocumentStatus(shreddedObligationFragments as never)).toEqual({
        obligationRegistry: '0xRegistry',
        status: ObligationDocumentStatus.Rejected,
        terminationReason: ObligationEscrowTerminationReason.Rejected,
      });
    });

    it('returns registry status for VALID ObligationRecords after discharge shred', () => {
      const fragments = [
        {
          type: 'DOCUMENT_STATUS',
          name: 'ObligationRecords',
          status: 'VALID',
          data: {
            obligationRegistry: '0xRegistry',
            status: ObligationDocumentStatus.Discharged,
            terminationReason: ObligationEscrowTerminationReason.Discharged,
          },
        },
      ];

      expect(getObligationDocumentStatus(fragments as never)).toEqual({
        obligationRegistry: '0xRegistry',
        status: ObligationDocumentStatus.Discharged,
        terminationReason: ObligationEscrowTerminationReason.Discharged,
      });
    });

    it('returns null when ObligationRecords is INVALID (unminted / zero owner)', () => {
      const fragments = [
        {
          type: 'DOCUMENT_STATUS',
          name: 'ObligationRecords',
          status: 'INVALID',
          reason: { message: 'Document has not been issued under token registry' },
          data: { obligationRegistry: '0xRegistry' },
        },
      ];

      expect(getObligationDocumentStatus(fragments as never)).toBeNull();
    });
  });

  describe('verify', () => {
    it('treats shredded BoE as DOCUMENT_STATUS VALID without dumping the registry address', async () => {
      const signale = await import('signale');

      await verify({ id: 'urn:uuid:shredded-boe' } as never);

      expect(verifyDocumentMock).toHaveBeenCalled();
      expect(signale.default.success).toHaveBeenCalledWith('DOCUMENT_STATUS: VALID');
      const infoMessages = (signale.default.info as unknown as { mock: { calls: unknown[][] } }).mock
        .calls
        .map((call) => String(call[0]));
      expect(infoMessages.join('\n')).not.toContain('Obligation document status');
      expect(infoMessages.join('\n')).not.toContain('registry=');
    });
  });
});
