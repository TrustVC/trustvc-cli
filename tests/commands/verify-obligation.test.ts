import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { verifyObligation, promptQuestions } from '../../src/commands/verify-obligation';
import fixture from '../fixtures/obligation/w3c-obligation-record.json';

vi.mock('signale', async (importOriginal) => {
  const originalSignale = await importOriginal<typeof import('signale')>();
  return {
    ...originalSignale,
    Signale: class MockSignale {
      await = vi.fn();
      success = vi.fn();
      error = vi.fn();
      info = vi.fn();
      warn = vi.fn();
      constructor() {}
    },
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    await: vi.fn(),
    default: {
      await: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  };
});

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn().mockResolvedValue('/tmp/doc.json'),
  select: vi.fn(),
  confirm: vi.fn(),
  password: vi.fn(),
}));

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    verifyObligationDocument: vi.fn().mockResolvedValue({
      valid: true,
      fragments: [
        { type: 'DOCUMENT_INTEGRITY', status: 'VALID', name: 'W3CSignatureIntegrity', data: true },
        {
          type: 'DOCUMENT_STATUS',
          status: 'VALID',
          name: 'ObligationRecords',
          data: {
            obligationRegistry: '0x71D28767662cB233F887aD2Bb65d048d760bA694',
            status: 0,
            terminationReason: 0,
          },
        },
        { type: 'ISSUER_IDENTITY', status: 'VALID', name: 'W3CIssuerIdentity', data: true },
      ],
    }),
    getObligationDocumentStatus: vi.fn().mockReturnValue({
      obligationRegistry: '0x71D28767662cB233F887aD2Bb65d048d760bA694',
      status: 0,
      terminationReason: 0,
    }),
    isObligationRecord: vi.fn(() => true),
    isWrappedV2Document: vi.fn(() => false),
    isWrappedV3Document: vi.fn(() => false),
    getChainId: vi.fn(() => 80002),
  };
});

vi.mock('../../src/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils')>();
  const { default: obligationFixture } =
    await import('../fixtures/obligation/w3c-obligation-record.json');
  return {
    ...actual,
    readJsonFile: vi.fn().mockReturnValue(obligationFixture),
    getSupportedNetworkNameFromId: vi.fn().mockReturnValue('amoy'),
    promptNetworkSelection: vi.fn(),
    CaptureConsoleWarnAsync: async (fn: () => Promise<any>) => ({
      result: await fn(),
      warnings: [],
    }),
  };
});

describe('verify-obligation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('promptQuestions reads document path', async () => {
    const doc = await promptQuestions();
    expect(doc).toEqual(fixture);
  });

  it('verifyObligation runs obligation pipeline and logs status', async () => {
    const trustvc = await import('@trustvc/trustvc');
    await verifyObligation(fixture as any);
    expect(trustvc.verifyObligationDocument as MockedFunction<any>).toHaveBeenCalled();
    expect(trustvc.getObligationDocumentStatus).toHaveBeenCalled();
  });
});
