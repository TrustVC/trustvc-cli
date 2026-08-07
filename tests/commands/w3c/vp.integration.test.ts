import { deriveW3C, issuer, signW3C, signW3CPresentation } from '@trustvc/trustvc';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { verify } from '../../../src/commands/verify';
import { signPresentation } from '../../../src/commands/w3c/vp-sign';
import { SignedVerifiablePresentation } from '../../../src/types';

vi.mock('signale', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    note: vi.fn(),
  },
  Signale: vi.fn().mockImplementation(() => ({
    await: vi.fn(),
    success: vi.fn(),
  })),
}));

// Asserts a value is defined and returns it narrowed (avoids `!` assertions).
const assertDefined = <T>(value: T | undefined | null, message: string): T => {
  if (value === undefined || value === null) throw new Error(message);
  return value;
};

/**
 * End-to-end VP tests using REAL crypto: a did:key holder self-issues a credential,
 * presents it with `vp-sign`, and the presentation is verified through the unified
 * `verify` command. Presentations are minted per-run rather than stored as fixtures
 * because a VP always carries an expiry.
 */
describe('verifiable presentation (integration)', () => {
  let outputPath: string;
  let holderDid: string;
  // The holder's did:key private key pair (id + controller bound to the did:key).
  let keyPairData: Record<string, unknown>;
  let derivedCredential: Record<string, unknown>;

  let signaleSuccessMock: MockedFunction<any>;
  let signaleWarnMock: MockedFunction<any>;
  let signaleErrorMock: MockedFunction<any>;
  let signaleInfoMock: MockedFunction<any>;

  const messages = () =>
    [
      ...signaleSuccessMock.mock.calls,
      ...signaleWarnMock.mock.calls,
      ...signaleErrorMock.mock.calls,
      ...signaleInfoMock.mock.calls,
    ]
      .map((call: any[]) => String(call[0]))
      .join('\n');

  beforeAll(async () => {
    outputPath = fs.mkdtempSync(path.join(os.tmpdir(), 'trustvc-vp-'));

    const { did, didKeyPairs } = await issuer.generateDidKeyPair('ecdsa-sd-2023');
    holderDid = did;
    keyPairData = didKeyPairs as Record<string, unknown>;

    // A credential ABOUT the holder — holder binding requires credentialSubject.id === holder.
    const raw = {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://trustvc.io/context/bill-of-lading.json',
      ],
      type: ['VerifiableCredential'],
      issuer: did,
      validFrom: '2024-04-01T12:19:52Z',
      credentialSubject: { id: did, type: ['BillOfLading'], blNumber: 'BL-123' },
    };
    const signed = await signW3C(raw as never, didKeyPairs as never, 'ecdsa-sd-2023');
    if (signed.error) throw new Error(`could not sign the test credential: ${signed.error}`);
    const derived = await deriveW3C(assertDefined(signed.signed, 'signed credential'), [
      '/credentialSubject/id',
      '/credentialSubject/blNumber',
    ]);
    if (derived.error) throw new Error(`could not derive the test credential: ${derived.error}`);
    derivedCredential = assertDefined(derived.derived, 'derived credential') as Record<
      string,
      unknown
    >;
  }, 60000);

  afterAll(() => {
    fs.rmSync(outputPath, { recursive: true, force: true });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const signale = await import('signale');
    signaleSuccessMock = (signale.default as any).success;
    signaleWarnMock = (signale.default as any).warn;
    signaleErrorMock = (signale.default as any).error;
    signaleInfoMock = (signale.default as any).info;
  });

  const sign = async (
    overrides: Partial<Parameters<typeof signPresentation>[0]> = {},
  ): Promise<SignedVerifiablePresentation | undefined> => {
    await signPresentation({
      credentials: [derivedCredential as never],
      keyPairData: keyPairData as never,
      holder: holderDid,
      lifetime: { expiresInSeconds: 600 },
      outputPath,
      ...overrides,
    });
    const signedVpPath = path.join(outputPath, 'signed_vp.json');
    if (!fs.existsSync(signedVpPath)) return undefined;
    return JSON.parse(fs.readFileSync(signedVpPath, 'utf8'));
  };

  it('signs a presentation the holder can prove ownership of', async () => {
    const vp = assertDefined(await sign(), 'signed VP');

    expect(vp.type).toContain('VerifiablePresentation');
    expect(vp.holder).toBe(holderDid);
    expect(vp.validFrom).toBeDefined();
    expect(vp.validUntil).toBeDefined();
    expect(vp.proof.cryptosuite).toBe('ecdsa-rdfc-2019');
    // The CLI never issues a challenge, so the proof is always an assertionMethod proof.
    expect(vp.proof.proofPurpose).toBe('assertionMethod');
    expect(vp.proof.challenge).toBeUndefined();
    expect(messages()).toContain('Verifiable Presentation signed successfully');
  }, 60000);

  it('refuses to sign when the holder does not match the credential subject', async () => {
    const vp = await sign({ holder: 'did:example:someone-else' });

    // Nothing was written for this run, so the file still holds the previous test's VP.
    expect(signaleErrorMock).toHaveBeenCalled();
    expect(String(signaleErrorMock.mock.calls[0][0])).toMatch(/does not match the holder/);
    expect(vp?.holder).not.toBe('did:example:someone-else');
  }, 60000);

  it('verifies a presentation through the unified verify pipeline', async () => {
    const vp = assertDefined(await sign(), 'signed VP');

    vi.clearAllMocks();
    await verify(vp as never);
    expect(signaleSuccessMock).toHaveBeenCalledWith('DOCUMENT_INTEGRITY: VALID');
    expect(signaleSuccessMock).toHaveBeenCalledWith('DOCUMENT_STATUS: VALID');
    expect(signaleSuccessMock).toHaveBeenCalledWith('ISSUER_IDENTITY: VALID');
    // The three lines read the same for one credential or five, so the count is stated.
    expect(signaleInfoMock).toHaveBeenCalledWith('1 embedded credential verified.');
  }, 60000);

  it('reports an unsigned presentation as invalid (ownership cannot be proven)', async () => {
    const vp = assertDefined(await sign(), 'signed VP');
    const unsigned = JSON.parse(JSON.stringify(vp));
    delete unsigned.proof;

    vi.clearAllMocks();
    await verify(unsigned as never);
    expect(messages()).toContain('DOCUMENT_INTEGRITY: INVALID');
  }, 60000);

  it('reports a tampered embedded credential as invalid', async () => {
    const vp = assertDefined(await sign(), 'signed VP');
    const tampered = JSON.parse(JSON.stringify(vp));
    const credential = Array.isArray(tampered.verifiableCredential)
      ? tampered.verifiableCredential[0]
      : tampered.verifiableCredential;
    credential.credentialSubject.blNumber = 'TAMPERED';

    vi.clearAllMocks();
    await verify(tampered as never);
    expect(messages()).toContain('DOCUMENT_INTEGRITY: INVALID');
  }, 60000);

  it('reports a presentation whose holder binding is broken as invalid', async () => {
    const vp = assertDefined(await sign(), 'signed VP');
    // The signer no longer matches the declared holder.
    const rebound = { ...JSON.parse(JSON.stringify(vp)), holder: 'did:example:someone-else' };

    vi.clearAllMocks();
    await verify(rebound as never);
    expect(messages()).toContain('DOCUMENT_INTEGRITY: INVALID');
  }, 60000);

  it('presents several credentials in one presentation', async () => {
    const vp = assertDefined(
      await sign({ credentials: [derivedCredential as never, derivedCredential as never] }),
      'signed VP',
    );
    expect(vp.verifiableCredential).toHaveLength(2);

    vi.clearAllMocks();
    await verify(vp as never);
    expect(signaleSuccessMock).toHaveBeenCalledWith('DOCUMENT_INTEGRITY: VALID');
    expect(signaleSuccessMock).toHaveBeenCalledWith('DOCUMENT_STATUS: VALID');
    expect(signaleSuccessMock).toHaveBeenCalledWith('ISSUER_IDENTITY: VALID');
    expect(signaleInfoMock).toHaveBeenCalledWith('2 embedded credentials verified.');
  }, 60000);

  it('does not state a credential count when the presentation is invalid', async () => {
    const vp = assertDefined(await sign(), 'signed VP');
    const unsigned = JSON.parse(JSON.stringify(vp));
    delete unsigned.proof;

    vi.clearAllMocks();
    await verify(unsigned as never);
    expect(messages()).toContain('DOCUMENT_INTEGRITY: INVALID');
    expect(messages()).not.toContain('embedded credential');
  }, 60000);

  it('reports an expired presentation as invalid', async () => {
    // `vp-sign` refuses a past `validUntil` at the prompt, so an expired presentation cannot
    // come from the CLI — but one handed to `verify` must still be caught. Built directly.
    const { signed, error } = await signW3CPresentation(
      derivedCredential as never,
      keyPairData as never,
      {
        holder: holderDid,
        validFrom: '2020-01-01T00:00:00Z',
        validUntil: '2020-01-02T00:00:00Z',
      } as never,
    );
    expect(error).toBeUndefined();

    vi.clearAllMocks();
    await verify(assertDefined(signed, 'signed VP') as never);
    // The signature is still sound — only the validity window has closed.
    expect(signaleSuccessMock).toHaveBeenCalledWith('DOCUMENT_INTEGRITY: VALID');
    expect(messages()).toContain('DOCUMENT_STATUS: INVALID');
    expect(messages()).toContain('has expired');
  }, 60000);
});

/**
 * The same flows with a PUBLISHED did:web, in both roles. These resolve
 * `did:web:trustvc.github.io:did:1` over the network, as the OA/W3C fixtures in
 * `tests/commands/verify.test.ts` already do.
 */
describe('verifiable presentation with a published did:web (integration, network)', () => {
  let outputPath: string;
  let signaleSuccessMock: MockedFunction<any>;

  // The did:web hosted at trustvc.github.io. `#multikey-1` is its ECDSA (P-256) Multikey;
  // this is the same public test key material the trustvc fixtures use.
  const HOSTED_DID = 'did:web:trustvc.github.io:did:1';
  const hostedKey = {
    id: `${HOSTED_DID}#multikey-1`,
    controller: HOSTED_DID,
    type: 'Multikey',
    publicKeyMultibase: 'zDnaemDNwi4G5eTzGfRooFFu5Kns3be6yfyVNtiaMhWkZbwtc',
    secretKeyMultibase: 'z42tmUXTVn3n9BihE6NhdMpvVBTnFTgmb6fw18o5Ud6puhRW',
  };

  const issueTo = async (issuerDid: string, issuerKey: unknown, subjectDid: string) => {
    const signed = await signW3C(
      {
        '@context': [
          'https://www.w3.org/ns/credentials/v2',
          'https://trustvc.io/context/bill-of-lading.json',
        ],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: '2024-04-01T12:19:52Z',
        credentialSubject: { id: subjectDid, type: ['BillOfLading'], blNumber: 'BL-HOSTED' },
      } as never,
      issuerKey as never,
      'ecdsa-sd-2023',
    );
    if (signed.error) throw new Error(`could not sign the test credential: ${signed.error}`);
    return assertDefined(signed.signed, 'signed credential');
  };

  beforeAll(() => {
    outputPath = fs.mkdtempSync(path.join(os.tmpdir(), 'trustvc-vp-hosted-'));
  });

  afterAll(() => {
    fs.rmSync(outputPath, { recursive: true, force: true });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const signale = await import('signale');
    signaleSuccessMock = (signale.default as any).success;
  });

  const presentAndVerify = async (credential: unknown, keyPair: unknown, holder: string) => {
    await signPresentation({
      credentials: [credential as never],
      keyPairData: keyPair as never,
      holder,
      lifetime: { expiresInSeconds: 600 },
      outputPath,
    });
    const vp = JSON.parse(fs.readFileSync(path.join(outputPath, 'signed_vp.json'), 'utf8'));
    vi.clearAllMocks();
    await verify(vp as never);
    return vp;
  };

  it('a did:web holder can present a credential issued by a did:key', async () => {
    const { did: issuerDid, didKeyPairs: issuerKey } =
      await issuer.generateDidKeyPair('ecdsa-sd-2023');
    const credential = await issueTo(issuerDid, issuerKey, HOSTED_DID);

    const vp = await presentAndVerify(credential, hostedKey, HOSTED_DID);

    expect(vp.holder).toBe(HOSTED_DID);
    expect(vp.proof.verificationMethod).toBe(`${HOSTED_DID}#multikey-1`);
    expect(signaleSuccessMock).toHaveBeenCalledWith('DOCUMENT_INTEGRITY: VALID');
    expect(signaleSuccessMock).toHaveBeenCalledWith('DOCUMENT_STATUS: VALID');
    expect(signaleSuccessMock).toHaveBeenCalledWith('ISSUER_IDENTITY: VALID');
  }, 60000);

  it('a did:key holder can present a credential issued by a did:web', async () => {
    const { did: holderDid, didKeyPairs: holderKey } =
      await issuer.generateDidKeyPair('ecdsa-sd-2023');
    // Not derived — `vp-sign` must auto full-disclose it.
    const credential = await issueTo(HOSTED_DID, hostedKey, holderDid);

    const vp = await presentAndVerify(credential, holderKey, holderDid);

    const embedded = Array.isArray(vp.verifiableCredential)
      ? vp.verifiableCredential[0]
      : vp.verifiableCredential;
    expect(embedded.issuer).toBe(HOSTED_DID);
    expect(vp.holder).toBe(holderDid);
    expect(signaleSuccessMock).toHaveBeenCalledWith('DOCUMENT_INTEGRITY: VALID');
    expect(signaleSuccessMock).toHaveBeenCalledWith('DOCUMENT_STATUS: VALID');
    expect(signaleSuccessMock).toHaveBeenCalledWith('ISSUER_IDENTITY: VALID');
  }, 60000);
});

/**
 * did:web identities are only usable once their DID document is actually published: the
 * issuer's must resolve when the credential is PRESENTED (trustvc verifies every credential
 * before putting it in a presentation), and the holder's must resolve when the presentation
 * is VERIFIED. Both halves are covered here — these are the traps a user hits after running
 * `did-web` and not yet hosting `wellknown.json`.
 */
describe('verifiable presentation with unpublished did:web identities (integration)', () => {
  let outputPath: string;
  let signaleErrorMock: MockedFunction<any>;
  let signaleWarnMock: MockedFunction<any>;
  let signaleSuccessMock: MockedFunction<any>;

  // A did:web key pair for a domain that does not exist — the same two calls the
  // `key-pair-generation` and `did-web` commands make.
  const makeUnpublishedDidWeb = async (domain: string) => {
    const keyPair = await issuer.generateKeyPair({ type: 'ecdsa-sd-2023' });
    const { didKeyPairs } = await issuer.issueDID({ ...keyPair, domain } as never);
    return didKeyPairs as Record<string, unknown> & { controller: string };
  };

  beforeAll(() => {
    outputPath = fs.mkdtempSync(path.join(os.tmpdir(), 'trustvc-vp-web-'));
  });

  afterAll(() => {
    fs.rmSync(outputPath, { recursive: true, force: true });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const signale = await import('signale');
    signaleErrorMock = (signale.default as any).error;
    signaleWarnMock = (signale.default as any).warn;
    signaleSuccessMock = (signale.default as any).success;
  });

  it('refuses to present a credential whose issuer did:web is not published', async () => {
    const issuerKey = await makeUnpublishedDidWeb('https://issuer.invalid/.well-known/did.json');
    const holderKey = await makeUnpublishedDidWeb('https://holder.invalid/.well-known/did.json');

    // Signing the credential works offline — only the private key is needed.
    const signed = await signW3C(
      {
        '@context': [
          'https://www.w3.org/ns/credentials/v2',
          'https://trustvc.io/context/bill-of-lading.json',
        ],
        type: ['VerifiableCredential'],
        issuer: issuerKey.controller,
        validFrom: '2024-04-01T12:19:52Z',
        credentialSubject: {
          id: holderKey.controller,
          type: ['BillOfLading'],
          blNumber: 'BL-WEB',
        },
      } as never,
      issuerKey as never,
      'ecdsa-sd-2023',
    );
    expect(signed.error).toBeUndefined();

    // Presenting it does not: the issuer's key cannot be fetched, so the credential cannot
    // be verified, so it must not be presented.
    await signPresentation({
      credentials: [assertDefined(signed.signed, 'signed credential') as never],
      keyPairData: holderKey as never,
      holder: holderKey.controller,
      lifetime: { expiresInSeconds: 600 },
      outputPath,
    });

    expect(signaleErrorMock).toHaveBeenCalled();
    expect(String(signaleErrorMock.mock.calls[0][0])).toMatch(/credential at index 0 is not valid/);
    expect(fs.existsSync(path.join(outputPath, 'signed_vp.json'))).toBe(false);
  }, 60000);

  it('signs for an unpublished did:web holder, but verification cannot resolve its key', async () => {
    // Issuer is a did:key (resolves in-memory), so signing the presentation gets that far.
    const { did: issuerDid, didKeyPairs: issuerKey } =
      await issuer.generateDidKeyPair('ecdsa-sd-2023');
    const holderKey = await makeUnpublishedDidWeb('https://holder.invalid/.well-known/did.json');

    const signed = await signW3C(
      {
        '@context': [
          'https://www.w3.org/ns/credentials/v2',
          'https://trustvc.io/context/bill-of-lading.json',
        ],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: '2024-04-01T12:19:52Z',
        credentialSubject: {
          id: holderKey.controller,
          type: ['BillOfLading'],
          blNumber: 'BL-WEB-2',
        },
      } as never,
      issuerKey as never,
      'ecdsa-sd-2023',
    );
    expect(signed.error).toBeUndefined();

    await signPresentation({
      credentials: [assertDefined(signed.signed, 'signed credential') as never],
      keyPairData: holderKey as never,
      holder: holderKey.controller,
      lifetime: { expiresInSeconds: 600 },
      outputPath,
    });

    // Signing succeeds — it only needs the holder's private key.
    const signedVpPath = path.join(outputPath, 'signed_vp.json');
    expect(signaleSuccessMock).toHaveBeenCalledWith('Verifiable Presentation signed successfully');
    const vp = JSON.parse(fs.readFileSync(signedVpPath, 'utf8'));

    // Verifying does not — the holder's public key cannot be fetched from the domain.
    vi.clearAllMocks();
    await verify(vp as never);
    const warnings = signaleWarnMock.mock.calls.map((call: any[]) => String(call[0])).join('\n');
    expect(warnings).toContain('DOCUMENT_INTEGRITY: INVALID');
  }, 60000);
});
