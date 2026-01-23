import * as prompts from '@inquirer/prompts';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { promptQuestions, verify } from '../../src/commands/verify';
import { SignedVerifiableCredential } from '@trustvc/trustvc';
import {
  getResultFromFragment,
  handleExpiredCredentialWarning,
  logResultStatus,
} from '../../src/commands/verify';
import { FragmentType } from '../../src/types';

const VERIFY_FIXTURES_DIR = path.resolve(process.cwd(), 'tests/fixtures/verify');
const PROMPT_QUESTIONS_FIXTURE_PATH = path.resolve(
  process.cwd(),
  'tests/fixtures/verify/w3c/bbs2020_w3c_verifiable_document_v1_1.json',
);

vi.mock('@inquirer/prompts');

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

describe('verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('helper functions', () => {
    let signaleSuccessMock: MockedFunction<any>;
    let signaleWarnMock: MockedFunction<any>;

    beforeEach(async () => {
      const signale = await import('signale');
      signaleSuccessMock = (signale.default as any).success;
      signaleWarnMock = (signale.default as any).warn;

      // Mock the interactive network selection prompt for ethereum mainnet for oa_dns_txt_docstore_no_network_field.json
      // This is used by promptNetworkSelection() when the document requires a network but has no chain/network info.
      // e.g. OA V2 files
      (prompts.select as any).mockResolvedValue('mainnet');
    });

    describe('getResultFromFragment', () => {
      it('should return the first non-SKIPPED fragment with matching type', () => {
        const fragments: any[] = [
          { type: FragmentType.DOCUMENT_STATUS, status: 'SKIPPED' },
          { type: FragmentType.DOCUMENT_STATUS, status: 'VALID', data: { ok: true } },
        ];

        const fragment = getResultFromFragment(FragmentType.DOCUMENT_STATUS, fragments as any);
        expect(fragment).toMatchObject({ type: FragmentType.DOCUMENT_STATUS, status: 'VALID' });
      });

      it('should throw when no matching non-SKIPPED fragment exists', () => {
        const fragments: any[] = [
          { type: FragmentType.DOCUMENT_STATUS, status: 'SKIPPED' },
          { type: FragmentType.DOCUMENT_INTEGRITY, status: 'VALID' },
        ];

        expect(() => getResultFromFragment(FragmentType.ISSUER_IDENTITY, fragments as any)).toThrow(
          'ISSUER_IDENTITY could not be verified.',
        );
      });
    });

    describe('logResultStatus', () => {
      it('should log success when fragment status is VALID', () => {
        logResultStatus({ type: FragmentType.DOCUMENT_INTEGRITY, status: 'VALID' } as any);
        expect(signaleSuccessMock).toHaveBeenCalledWith('DOCUMENT_INTEGRITY: VALID');
        expect(signaleWarnMock).not.toHaveBeenCalled();
      });

      it('should log warning when fragment status is not VALID', () => {
        logResultStatus({
          type: 'DOCUMENT_STATUS',
          status: 'INVALID',
          reason: { message: 'Revoked' },
        } as any);

        expect(signaleWarnMock).toHaveBeenCalledWith('DOCUMENT_STATUS: INVALID [Revoked]');
      });
    });

    describe('handleExpiredCredentialWarning', () => {
      it('should log when expiration warning is present', () => {
        handleExpiredCredentialWarning([['Credential has expired.']]);
        expect(signaleWarnMock).toHaveBeenCalledWith('The document credential has expired.');
      });

      it('should not log when there is no expiration warning', () => {
        handleExpiredCredentialWarning([['Some other warning']]);
        expect(signaleWarnMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('promptQuestions', () => {
    it('should return parsed signed VC from readJsonFile', async () => {
      (prompts.input as any).mockResolvedValueOnce(PROMPT_QUESTIONS_FIXTURE_PATH);

      const result = await promptQuestions();

      expect(result).toBeTruthy();
    });

    it('should abide by validation rules for path input', async () => {
      (prompts.input as any).mockResolvedValueOnce(PROMPT_QUESTIONS_FIXTURE_PATH);

      await promptQuestions();

      const inputArgs = (prompts.input as any).mock.calls[0][0];

      expect(inputArgs.required).toBe(true);
      expect(inputArgs.validate('')).toBe('Document file path is required');
      expect(inputArgs.validate('   ')).toBe('Document file path is required');
      expect(inputArgs.validate('./signed_vc.json')).toBe(true);
    });

    it('should throw error when given an invalid signed VC file path (readJsonFile fails)', async () => {
      const missingPath = './missing.json';

      (prompts.input as any).mockResolvedValueOnce(missingPath);

      await expect(promptQuestions()).rejects.toThrow(`Invalid document file path: ${missingPath}`);
    });
  });

  describe('verify', () => {
    let signaleSuccessMock: MockedFunction<any>;
    let signaleWarnMock: MockedFunction<any>;

    // Helper function to list all JSON fixture files in a directory recursively
    const listVerifyFixturePathsRecursively = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.flatMap((entry) => {
        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) return listVerifyFixturePathsRecursively(absolutePath);
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) return [absolutePath];
        return [];
      });
    };

    const verifyFixturePaths: string[] =
      listVerifyFixturePathsRecursively(VERIFY_FIXTURES_DIR).sort();

    const inferExpectedWarning = (filePath: string) => {
      const fileName = path.basename(filePath).toLowerCase();
      if (fileName.includes('revoked')) return 'revoked';
      if (fileName.includes('expired')) return 'expired';
      return 'none';
    };

    beforeEach(async () => {
      const signale = await import('signale');
      signaleSuccessMock = (signale.default as any).success;
      signaleWarnMock = (signale.default as any).warn;
    });

    type TestCase = {
      name: string;
      filePath: string;
      expectedWarning: string;
    };

    const testCases: TestCase[] = verifyFixturePaths.map((filePath) => ({
      name: path.basename(filePath),
      filePath: filePath,
      expectedWarning: inferExpectedWarning(filePath),
    }));

    it.each(testCases)('should verify real signed VC fixture: $name', async (testCase) => {
      const { filePath, expectedWarning } = testCase;
      const utils = await import('../../src/utils');
      const signedVC = utils.readJsonFile<SignedVerifiableCredential>(filePath, 'document');

      await verify(signedVC);

      // Ensure "no network info" OA fixture triggers the network selection.
      // Other fixtures that have network info should not trigger the network selection.
      const baseName = path.basename(filePath).toLowerCase();
      if (baseName.includes('no_network_field')) {
        expect(prompts.select).toHaveBeenCalled();
      } else {
        expect(prompts.select).not.toHaveBeenCalled();
      }

      const successCalls = signaleSuccessMock.mock.calls ?? [];
      const warnCalls = signaleWarnMock.mock.calls ?? [];

      const successMessages = successCalls.map((call: any[]) => call[0]);
      const warnMessages = warnCalls.map((call: any[]) => call[0]);

      const combinedMessages = [...successMessages, ...warnMessages];

      expect(combinedMessages.join('\n')).toContain('DOCUMENT_INTEGRITY:');
      expect(combinedMessages.join('\n')).toContain('ISSUER_IDENTITY:');
      expect(combinedMessages.join('\n')).toContain('DOCUMENT_STATUS:');

      if (expectedWarning === 'revoked') {
        expect(warnMessages.length).toBeGreaterThan(0);
        expect(warnMessages.join('\n')).toContain(
          'DOCUMENT_STATUS: INVALID [Document has been revoked.]',
        );
      }

      if (expectedWarning === 'expired') {
        expect(warnMessages.length).toBeGreaterThan(0);
        expect(warnMessages.join('\n')).toContain('The document credential has expired.');
      }

      if (expectedWarning === 'none') {
        expect(successMessages).toEqual(
          expect.arrayContaining([
            'DOCUMENT_INTEGRITY: VALID',
            'DOCUMENT_STATUS: VALID',
            'ISSUER_IDENTITY: VALID',
          ]),
        );
      }
    });
  });
});
