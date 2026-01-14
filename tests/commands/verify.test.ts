import * as prompts from '@inquirer/prompts';
import path from 'node:path';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { promptQuestions, verify } from '../../src/commands/verify';
import { SignedVerifiableCredential } from '@trustvc/trustvc';
import { getResultFromFragment, handleExpiredCredentialWarning, logResultStatus } from '../../src/commands/verify';


const W3C_SIGNED_VC_DEFAULT_FIXTURE_PATH = path.resolve(
    process.cwd(),
    'tests/fixtures/w3c/certificate-of-origin-default.json',
);
const W3C_SIGNED_VC_EXPIRED_FIXTURE_PATH = path.resolve(
    process.cwd(),
    'tests/fixtures/w3c/certificate-of-origin-expired.json',
);  
const W3C_SIGNED_VC_REDACTED_FIXTURE_PATH = path.resolve(
    process.cwd(),
    'tests/fixtures/w3c/certificate-of-origin-redacted.json',
);
const W3C_SIGNED_VC_REVOKED_FIXTURE_PATH = path.resolve(
    process.cwd(),
    'tests/fixtures/w3c/certificate-of-origin-revoked.json',
);
const OA_SIGNED_VC_DEFAULT_FIXTURE_PATH = path.resolve(
    process.cwd(),
    'tests/fixtures/oa/certificate-of-origin-default.json',
);
const OA_SIGNED_VC_EXPIRED_FIXTURE_PATH = path.resolve(
    process.cwd(),
    'tests/fixtures/oa/certificate-of-origin-expired.json',
);
const OA_SIGNED_VC_REDACTED_FIXTURE_PATH = path.resolve(
    process.cwd(),
    'tests/fixtures/oa/certificate-of-origin-redacted.json',
);
const OA_SIGNED_VC_REVOKED_FIXTURE_PATH = path.resolve(
    process.cwd(),
    'tests/fixtures/oa/certificate-of-origin-revoked.json',
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
        vi.resetAllMocks();
    });

    describe('helper functions', () => {
        let signaleSuccessMock: MockedFunction<any>;
        let signaleWarnMock: MockedFunction<any>;

        beforeEach(async () => {
            const signale = await import('signale');
            signaleSuccessMock = (signale.default as any).success;
            signaleWarnMock = (signale.default as any).warn;
        });

        describe('getResultFromFragment', () => {
            it('should return the first non-SKIPPED fragment with matching type', () => {
                const fragments: any[] = [
                    { type: 'DOCUMENT_STATUS', status: 'SKIPPED' },
                    { type: 'DOCUMENT_STATUS', status: 'VALID', data: { ok: true } },
                ];

                const fragment = getResultFromFragment('DOCUMENT_STATUS', fragments as any);
                expect(fragment).toMatchObject({ type: 'DOCUMENT_STATUS', status: 'VALID' });
            });

            it('should throw when no matching non-SKIPPED fragment exists', () => {
                const fragments: any[] = [
                    { type: 'DOCUMENT_STATUS', status: 'SKIPPED' },
                    { type: 'DOCUMENT_INTEGRITY', status: 'VALID' },
                ];

                expect(() => getResultFromFragment('ISSUER_IDENTITY', fragments as any)).toThrow(
                    'ISSUER_IDENTITY could not be verified.',
                );
            });
        });

        describe('logResultStatus', () => {
            it('should log success when fragment status is VALID', () => {
                logResultStatus({ type: 'DOCUMENT_INTEGRITY', status: 'VALID' } as any);
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
            it('should not log when expiration warning is present (currently intentionally silent)', () => {
                handleExpiredCredentialWarning([['Credential has expired.']]);
                expect(signaleWarnMock).not.toHaveBeenCalled();
            });

            it('should not log when there is no expiration warning', () => {
                handleExpiredCredentialWarning([['Some other warning']]);
                expect(signaleWarnMock).not.toHaveBeenCalled();
            });
        });
    });

    describe('promptQuestions', () => {
        it('should return parsed signed VC from readJsonFile', async () => {
            (prompts.input as any).mockResolvedValueOnce(W3C_SIGNED_VC_DEFAULT_FIXTURE_PATH);

            const result = await promptQuestions();

            expect(result).toBeTruthy();
        });

        it('should abide by validation rules for path input', async () => {
            (prompts.input as any).mockResolvedValueOnce(W3C_SIGNED_VC_DEFAULT_FIXTURE_PATH);

            await promptQuestions();

            const inputArgs = (prompts.input as any).mock.calls[0][0];

            expect(inputArgs.required).toBe(true);
            expect(inputArgs.validate('')).toBe('signed Verifiable Credential file path is required');
            expect(inputArgs.validate('   ')).toBe('signed Verifiable Credential file path is required');
            expect(inputArgs.validate('./signed_vc.json')).toBe(true);
        });

        it('should throw error when given an invalid signed VC file path (readJsonFile fails)', async () => {
            const missingPath = './missing.json';

            (prompts.input as any).mockResolvedValueOnce(missingPath);

            await expect(promptQuestions()).rejects.toThrow(
                `Invalid document file path: ${missingPath}`,
            );
        });
    });

    describe.sequential('verify', () => {
        let signaleSuccessMock: MockedFunction<any>;
        let signaleWarnMock: MockedFunction<any>;

        beforeEach(async () => {
            const signale = await import('signale');
            signaleSuccessMock = (signale.default as any).success;
            signaleWarnMock = (signale.default as any).warn;
        });

        const testCases = [
            {
                name: 'default w3c',
                filePath: W3C_SIGNED_VC_DEFAULT_FIXTURE_PATH,
                expectWarn: false,
            },
            {
                name: 'expired w3c',
                filePath: W3C_SIGNED_VC_EXPIRED_FIXTURE_PATH,
                expectWarn: false,
            },
            {
                name: 'redacted w3c',
                filePath: W3C_SIGNED_VC_REDACTED_FIXTURE_PATH,
                expectWarn: false,
            },
            {
                name: 'revoked w3c',
                filePath: W3C_SIGNED_VC_REVOKED_FIXTURE_PATH,
                expectWarn: true,
            },
            {
                name: 'default oa',
                filePath: OA_SIGNED_VC_DEFAULT_FIXTURE_PATH,
                expectWarn: false,
            },
            {
                name: 'expired oa',
                filePath: OA_SIGNED_VC_EXPIRED_FIXTURE_PATH,
                expectWarn: false,
            },
            {
                name: 'redacted oa',
                filePath: OA_SIGNED_VC_REDACTED_FIXTURE_PATH,
                expectWarn: false,
            },
            {
                name: 'revoked oa',
                filePath: OA_SIGNED_VC_REVOKED_FIXTURE_PATH,
                expectWarn: true,
            },
        ];

        it.each(testCases)(
            'should verify real signed VC fixture: $name',
            async ({ filePath, expectWarn }) => {
                const utils = await import('../../src/utils');
                const signedVC = utils.readJsonFile<SignedVerifiableCredential>(filePath, 'document');

                await verify(signedVC);

                const successCalls = signaleSuccessMock.mock.calls ?? [];
                const warnCalls = signaleWarnMock.mock.calls ?? [];

                const successMessages = successCalls.map((call: any[]) => call[0]);
                const warnMessages = warnCalls.map((call: any[]) => call[0]);

                const combinedMessages = [...successMessages, ...warnMessages];

                expect(successMessages.join('\n')).toContain('DOCUMENT_INTEGRITY:');
                expect(successMessages.join('\n')).toContain('ISSUER_IDENTITY:');
                expect(combinedMessages.join('\n')).toContain('DOCUMENT_STATUS:');

                if (expectWarn) {
                    expect(warnMessages.length).toBeGreaterThan(0);
                    expect(warnMessages.join('\n')).toContain('DOCUMENT_STATUS:');
                } else {
                    expect(warnMessages.length).toBe(0);
                    expect(successMessages).toEqual(
                        expect.arrayContaining([
                            'DOCUMENT_INTEGRITY: VALID',
                            'DOCUMENT_STATUS: VALID',
                            'ISSUER_IDENTITY: VALID',
                        ])
                    );
                }
            },
        );
    });
});
