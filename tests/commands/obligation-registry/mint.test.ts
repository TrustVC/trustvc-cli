import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  handler,
  mintObligationToken,
  promptForInputs,
} from '../../../src/commands/obligation-registry/mint';
import { NetworkCmdName } from '../../../src/utils';

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
  select: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
  password: vi.fn(),
}));

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    mintObligationRegistry: vi.fn(),
    isObligationRecord: vi.fn(() => true),
    getObligationRegistryAddress: vi.fn(() => '0x71D28767662cB233F887aD2Bb65d048d760bA694'),
    getTokenId: vi.fn(() => '0x23f719b016c88ba1ef2e10c0718d7d0f0026b1dc6e219629f81e2f0f811c4e3e'),
    getChainId: vi.fn(() => 80002),
  };
});

vi.mock('../../../src/commands/helpers', () => ({
  connectToObligationRegistry: vi.fn().mockResolvedValue({
    mint: {
      populateTransaction: vi.fn().mockResolvedValue({ to: '0xRegistry', data: '0x' }),
    },
  }),
  validateAndEncryptRemark: vi.fn((r?: string) => r || '0x'),
}));

vi.mock('../../../src/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils')>();
  const { default: obligationFixture } =
    await import('../../fixtures/obligation/w3c-obligation-record.json');
  return {
    ...actual,
    promptAndReadDocument: vi.fn().mockResolvedValue(obligationFixture),
    verifyDocumentSignature: vi.fn().mockResolvedValue(undefined),
    extractObligationDocumentInfo: vi.fn().mockResolvedValue({
      document: obligationFixture,
      obligationRegistry: '0x71D28767662cB233F887aD2Bb65d048d760bA694',
      tokenId: '0x23f719b016c88ba1ef2e10c0718d7d0f0026b1dc6e219629f81e2f0f811c4e3e',
      network: 'amoy',
      documentId: 'urn:uuid:obligation-test-doc-id',
    }),
    promptAddress: vi.fn(),
    promptWalletSelection: vi.fn().mockResolvedValue({ key: '0xabc' }),
    promptRemark: vi.fn().mockResolvedValue('issued'),
    getWalletOrSigner: vi.fn().mockResolvedValue({
      getAddress: vi.fn().mockResolvedValue('0xWallet'),
      provider: {},
    }),
    performDryRunWithConfirmation: vi.fn().mockResolvedValue(true),
    canEstimateGasPrice: vi.fn().mockReturnValue(false),
    displayTransactionPrice: vi.fn(),
    getEtherscanAddress: vi.fn().mockReturnValue('https://amoy.polygonscan.com'),
    addAddressPrefix: (v: string) => (v.startsWith('0x') ? v : `0x${v}`),
    getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  };
});

describe('obligation-registry/mint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promptForInputs builds mint command from obligation document', async () => {
    const utils = await import('../../../src/utils');
    (utils.promptAddress as MockedFunction<any>)
      .mockResolvedValueOnce('0xBeneficiary000000000000000000000000000001')
      .mockResolvedValueOnce('0xHolder0000000000000000000000000000000002');

    const result = await promptForInputs();
    expect(result.address).toBe('0x71D28767662cB233F887aD2Bb65d048d760bA694');
    expect(result.beneficiary).toBe('0xBeneficiary000000000000000000000000000001');
    expect(result.holder).toBe('0xHolder0000000000000000000000000000000002');
    expect(result.remark).toBe('issued');
  });

  it('mintObligationToken calls mintObligationRegistry', async () => {
    const trustvc = await import('@trustvc/trustvc');
    const mintMock = trustvc.mintObligationRegistry as MockedFunction<any>;
    mintMock.mockResolvedValue({
      hash: '0xmint',
      wait: vi.fn().mockResolvedValue({ hash: '0xmint' }),
    });

    await mintObligationToken({
      network: NetworkCmdName.Amoy,
      address: '0x71D28767662cB233F887aD2Bb65d048d760bA694',
      tokenId: '0x23f719b016c88ba1ef2e10c0718d7d0f0026b1dc6e219629f81e2f0f811c4e3e',
      beneficiary: '0xBeneficiary000000000000000000000000000001',
      holder: '0xHolder0000000000000000000000000000000002',
      remark: 'issued',
      encryptionKey: 'urn:uuid:obligation-test-doc-id',
      key: '0xabc',
      maxPriorityFeePerGasScale: 1,
    });

    expect(mintMock).toHaveBeenCalledWith(
      { obligationRegistryAddress: '0x71D28767662cB233F887aD2Bb65d048d760bA694' },
      expect.anything(),
      expect.objectContaining({
        beneficiaryAddress: '0xBeneficiary000000000000000000000000000001',
        holderAddress: '0xHolder0000000000000000000000000000000002',
      }),
      expect.objectContaining({ id: 'urn:uuid:obligation-test-doc-id' }),
    );
  });

  it('handler completes mint flow', async () => {
    const utils = await import('../../../src/utils');
    (utils.promptAddress as MockedFunction<any>)
      .mockResolvedValueOnce('0xBeneficiary000000000000000000000000000001')
      .mockResolvedValueOnce('0xHolder0000000000000000000000000000000002');

    const trustvc = await import('@trustvc/trustvc');
    (trustvc.mintObligationRegistry as MockedFunction<any>).mockResolvedValue({
      hash: '0xmint',
      wait: vi.fn().mockResolvedValue({ hash: '0xmint' }),
    });

    await expect(handler()).resolves.toBeUndefined();
  });
});
