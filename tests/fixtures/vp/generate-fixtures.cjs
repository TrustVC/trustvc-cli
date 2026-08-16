/**
 * Regenerates the Verifiable Presentation fixtures in this directory.
 *
 *   node tests/fixtures/vp/generate-fixtures.cjs
 *   npx prettier --write "tests/fixtures/vp/*.json"
 *
 * Everything is did:key based, so no DID document has to be hosted anywhere and the
 * fixtures verify offline. See README.md in this directory for what each file is for.
 */
const fs = require('fs');
const path = require('path');
const {
  deriveW3C,
  issuer,
  signW3C,
  signW3CPresentation,
} = require('@trustvc/trustvc');

const OUT = __dirname;
// `credentials/` holds ONLY presentable credentials, so the whole folder can be handed to
// `vp-sign` as-is. `presentations/` holds the ready-made inputs for `verify`.
// `invalid-credentials/` holds one file per reason `vp-sign` can refuse a credential —
// pass them ONE AT A TIME, never the folder, or you only see the first refusal.
const CREDENTIALS = path.join(OUT, 'credentials');
const PRESENTATIONS = path.join(OUT, 'presentations');
const INVALID = path.join(OUT, 'invalid-credentials');
// `invalid-keypairs/` holds key pairs `vp-sign` cannot sign with, one per reason.
const INVALID_KEYS = path.join(OUT, 'invalid-keypairs');

// Far enough out that the ready-made presentations do not expire during normal use.
const FAR_FUTURE = '2999-01-01T00:00:00Z';

const write = (dir, name, data) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${path.relative(OUT, path.join(dir, name))}`);
};

/** Signs a bill of lading credential for `subjectDid` and reveals it in full. */
const makeCredential = async (issuerDid, keyPair, subjectDid, blNumber) => {
  const raw = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://trustvc.io/context/bill-of-lading.json',
    ],
    type: ['VerifiableCredential'],
    issuer: issuerDid,
    validFrom: '2024-04-01T12:19:52Z',
    credentialSubject: { id: subjectDid, type: ['BillOfLading'], blNumber },
  };
  const signed = await signW3C(raw, keyPair, 'ecdsa-sd-2023');
  if (signed.error) throw new Error(`sign failed: ${signed.error}`);
  const derived = await deriveW3C(signed.signed, [
    '/credentialSubject/id',
    '/credentialSubject/blNumber',
  ]);
  if (derived.error) throw new Error(`derive failed: ${derived.error}`);
  return derived.derived;
};

/** Signs a raw credential and reveals `pointers` (defaults to the subject id + blNumber). */
const signAndDerive = async (raw, keyPair, pointers, signOptions) => {
  const signed = await signW3C(raw, keyPair, 'ecdsa-sd-2023', signOptions);
  if (signed.error) throw new Error(`sign failed: ${signed.error}`);
  if (!pointers) return signed.signed; // base (underived) credential
  const derived = await deriveW3C(signed.signed, pointers);
  if (derived.error) throw new Error(`derive failed: ${derived.error}`);
  return derived.derived;
};

const sign = async (credentials, keyPair, holder, options) => {
  const { signed, error } = await signW3CPresentation(credentials, keyPair, {
    holder,
    ...options,
  });
  if (error) throw new Error(`sign presentation failed: ${error}`);
  return signed;
};

(async () => {
  // The holder: a did:key whose key pair signs both the credentials and the presentation.
  const { did: holderDid, didKeyPairs: holderKey } =
    await issuer.generateDidKeyPair('ecdsa-sd-2023');
  // A second party, used for the credential that is about somebody else.
  const { did: otherDid } = await issuer.generateDidKeyPair('ecdsa-sd-2023');

  write(OUT, 'didKeyPairs.json', holderKey);

  // Both are about the holder, so `vp-sign` can be pointed at `credentials/` directly.
  const vc1 = await makeCredential(holderDid, holderKey, holderDid, 'BL-0001');
  const vc2 = await makeCredential(holderDid, holderKey, holderDid, 'BL-0002');
  write(CREDENTIALS, 'signed_vc.json', vc1);
  write(CREDENTIALS, 'signed_vc_2.json', vc2);

  const validVp = await sign(vc1, holderKey, holderDid, { validUntil: FAR_FUTURE });
  write(PRESENTATIONS, 'signed_vp.json', validVp);

  write(
    PRESENTATIONS,
    'signed_vp_multi.json',
    await sign([vc1, vc2], holderKey, holderDid, { validUntil: FAR_FUTURE }),
  );

  // Expired: a presentation whose window closed in 2020 — the crypto is still sound.
  write(
    PRESENTATIONS,
    'expired_vp.json',
    await sign(vc1, holderKey, holderDid, {
      validFrom: '2020-01-01T00:00:00Z',
      validUntil: '2020-01-02T00:00:00Z',
    }),
  );

  // Unsigned: no holder proof, so ownership cannot be proven.
  const unsigned = JSON.parse(JSON.stringify(validVp));
  delete unsigned.proof;
  write(PRESENTATIONS, 'unsigned_vp.json', unsigned);

  // Tampered: an embedded credential was edited after the presentation was signed.
  const tampered = JSON.parse(JSON.stringify(validVp));
  const embedded = Array.isArray(tampered.verifiableCredential)
    ? tampered.verifiableCredential[0]
    : tampered.verifiableCredential;
  embedded.credentialSubject.blNumber = 'TAMPERED';
  write(PRESENTATIONS, 'tampered_vp.json', tampered);

  // The declared holder was swapped after signing. `holder` is part of the signed payload,
  // so this breaks the proof itself rather than surfacing as a holder-binding message.
  write(PRESENTATIONS, 'tampered_holder_vp.json', {
    ...JSON.parse(JSON.stringify(validVp)),
    holder: otherDid,
  });

  // An embedded credential naming an issuer that cannot be resolved — the shape of a
  // credential whose issuer has since taken its DID document down. This is the only way to
  // reach ISSUER_IDENTITY: INVALID, since `vp-sign` refuses to present a credential whose
  // issuer it cannot resolve. Editing the credential also breaks the holder proof, so
  // DOCUMENT_INTEGRITY goes INVALID alongside it.
  const unresolvableIssuer = JSON.parse(JSON.stringify(validVp));
  const credential = Array.isArray(unresolvableIssuer.verifiableCredential)
    ? unresolvableIssuer.verifiableCredential[0]
    : unresolvableIssuer.verifiableCredential;
  credential.issuer = 'did:web:nope.invalid';
  write(PRESENTATIONS, 'unresolvable_issuer_vp.json', unresolvableIssuer);

  // ---------------------------------------------------------------------------------
  // invalid-credentials/ — one file per reason `vp-sign` refuses a credential.
  // ---------------------------------------------------------------------------------
  const BOL_CONTEXT = [
    'https://www.w3.org/ns/credentials/v2',
    'https://trustvc.io/context/bill-of-lading.json',
  ];
  const bol = (extra) => ({
    '@context': BOL_CONTEXT,
    type: ['VerifiableCredential'],
    issuer: holderDid,
    validFrom: '2024-04-01T12:19:52Z',
    credentialSubject: { id: holderDid, type: ['BillOfLading'], blNumber: 'BL-BAD' },
    ...extra,
  });

  // Subject is a different DID, so holder binding cannot hold.
  write(INVALID, 'other_holder.json', await makeCredential(holderDid, holderKey, otherDid, 'BL-0003'));

  // No credentialSubject.id at all. It must be ABSENT AT ISSUANCE: selective disclosure
  // keeps a subject id that was there when the credential was signed.
  write(
    INVALID,
    'no_subject_id.json',
    await signAndDerive(
      { ...bol(), credentialSubject: { type: ['BillOfLading'], blNumber: 'BL-BAD' } },
      holderKey,
      ['/credentialSubject/blNumber'],
    ),
  );

  // Validity window closed in 2021.
  write(
    INVALID,
    'expired.json',
    await signAndDerive(
      bol({ validFrom: '2020-01-01T00:00:00Z', validUntil: '2021-01-01T00:00:00Z' }),
      holderKey,
      ['/credentialSubject/id', '/credentialSubject/blNumber', '/validUntil'],
    ),
  );

  // Revoked on the hosted status list (index 5). Left UNDERIVED so `vp-sign` full-discloses
  // it and can see the credentialStatus — a narrow derivation would strip that entry and the
  // revocation would go unnoticed.
  write(
    INVALID,
    'revoked.json',
    await signAndDerive(
      {
        ...bol(),
        '@context': [...BOL_CONTEXT, 'https://w3id.org/vc/status-list/2021/v1'],
        credentialStatus: {
          id: 'https://trustvc.github.io/did/credentials/statuslist/1#5',
          type: 'StatusList2021Entry',
          statusPurpose: 'revocation',
          statusListIndex: '5',
          statusListCredential: 'https://trustvc.github.io/did/credentials/statuslist/1',
        },
      },
      holderKey,
    ),
  );

  // A transferable record — ownership lives on-chain, so it cannot be presented.
  write(
    INVALID,
    'transferable_record.json',
    await signAndDerive(
      {
        ...bol(),
        '@context': [
          ...BOL_CONTEXT,
          'https://trustvc.io/context/transferable-records-context.json',
        ],
        // `tokenId` is derived by trustvc at signing time and must not be supplied here.
        credentialStatus: {
          type: 'TransferableRecords',
          tokenNetwork: { chain: 'MATIC', chainId: 80002 },
          tokenRegistry: '0x6c2a002A5833a100f38458c50F11E71Aa1A342c6',
        },
      },
      holderKey,
    ),
  );

  // Issued by a did:web that is not published, so its key cannot be fetched to verify it.
  const ghostKp = await issuer.generateKeyPair({ type: 'ecdsa-sd-2023' });
  const { didKeyPairs: ghostKey } = await issuer.issueDID({
    ...ghostKp,
    domain: 'https://nope.invalid/.well-known/did.json',
  });
  write(
    INVALID,
    'unresolvable_issuer.json',
    await signAndDerive({ ...bol(), issuer: ghostKey.controller }, ghostKey, [
      '/credentialSubject/id',
      '/credentialSubject/blNumber',
    ]),
  );

  // Edited after signing.
  const tamperedVc = JSON.parse(JSON.stringify(vc1));
  tamperedVc.credentialSubject.blNumber = 'TAMPERED';
  write(INVALID, 'tampered.json', tamperedVc);

  // Never signed — a raw credential has no proof to check.
  write(INVALID, 'unsigned.json', bol());

  // ---------------------------------------------------------------------------------
  // invalid-keypairs/ — key pairs `vp-sign` cannot sign the presentation with.
  // ---------------------------------------------------------------------------------

  // What `key-pair-generation` writes: key material with no DID, so there is no holder.
  write(INVALID_KEYS, 'no_controller.json', await issuer.generateKeyPair({ type: 'ecdsa-sd-2023' }));

  // A DID-bound key pair with the private half removed.
  const noSecret = { ...holderKey };
  delete noSecret.secretKeyMultibase;
  write(INVALID_KEYS, 'missing_secret_key.json', noSecret);

  // Well-formed shape, key material that is not a key.
  write(INVALID_KEYS, 'garbage_key_material.json', {
    ...holderKey,
    publicKeyMultibase: 'zGARBAGEKEYNOTVALID',
    secretKeyMultibase: 'zGARBAGEKEYNOTVALID',
  });

  // A BBS key pair. Presentation proofs use ecdsa-rdfc-2019, which needs ECDSA (P-256).
  // Pair it with `invalid-credentials/for_bbs_holder.json`: a BBS did:key is a DIFFERENT DID,
  // so with any other credential holder binding fails first and the suite is never reached.
  const bbs = await issuer.generateDidKeyPair('bbs-2023');
  write(INVALID_KEYS, 'wrong_suite_bbs.json', bbs.didKeyPairs);
  write(
    INVALID,
    'for_bbs_holder.json',
    await makeCredential(holderDid, holderKey, bbs.did, 'BL-BBS'),
  );

  // A perfectly good key pair — belonging to somebody who is not the credential subject.
  const stranger = await issuer.generateDidKeyPair('ecdsa-sd-2023');
  write(INVALID_KEYS, 'different_holder.json', stranger.didKeyPairs);

  // Claims the holder's DID and public key, but carries a stranger's private key.
  write(INVALID_KEYS, 'mismatched_secret_key.json', {
    ...holderKey,
    secretKeyMultibase: stranger.didKeyPairs.secretKeyMultibase,
  });

  console.log(`\nholder did: ${holderDid}\nother did:  ${otherDid}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
