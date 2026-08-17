/**
 * Regenerates every Verifiable Presentation fixture in this directory.
 *
 *   node tests/fixtures/vp/generate.cjs
 *   npx prettier --write "tests/fixtures/vp/**\/*.json"
 *
 * ONE holder key pair signs everything, so any file here can be combined with any other and the
 * holder binding still lines up. That is why the set is all-or-nothing: there is no regenerating
 * part of it, and every run mints a fresh DID.
 *
 * Layout — by what the document IS, so a file's kind and its expected outcome are both visible
 * from its path:
 *
 *   keys/holder.json            the holder key pair — the answer to every key-pair prompt
 *   keys/invalid/               one per reason vp-sign cannot sign with a key
 *   credentials/presentable/    vp-sign accepts these; hand the WHOLE FOLDER to it
 *   credentials/rejected/       one per reason vp-sign refuses a credential (pass ONE at a time)
 *   presentations/valid/        verify -> all three fragments VALID
 *   presentations/invalid/      verify -> a named failure, one per file
 *
 * Everything is did:key, so nothing has to be hosted and the set verifies offline — except
 * `credentials/rejected/revoked.json` and `presentations/invalid/credential_revoked.json`, which
 * fetch a status list, and the two unresolvable-issuer files, which must attempt DID resolution
 * and fail. Each credential is self-issued (issuer = holder) purely so the set is self-contained;
 * in real use the issuer is a different party, which changes nothing — holder binding only checks
 * holder = signer = `credentialSubject.id`.
 *
 * ## Two things that cannot be built the obvious way
 *
 * `signW3CPresentation` refuses to present a credential that is expired, not yet valid, or
 * revoked. Swapping a bad credential into an already-signed presentation does not work either:
 * the credentials sit inside the signed payload, so the swap breaks the holder proof and the
 * result reports `DOCUMENT_INTEGRITY: INVALID - Invalid signature.` — indistinguishable from
 * tampering, and saying nothing about why the credential is bad. So:
 *
 * - **expired** is built by signing inside a window short enough to lapse before this script
 *   exits (hence the pause near the end). The proof stays intact; the clock does the work.
 * - **revoked** has no window to wait out — the bit lives on a status list we do not control —
 *   so it uses the split in `@trustvc/w3c-vc`: `createPresentation` runs the credential checks,
 *   `signPresentation` runs none. Build the envelope around a credential that passes, swap the
 *   revoked one in, then sign, so the proof covers it and integrity stays VALID.
 *
 * Both are honest documents: correctly signed presentations of something that went bad
 * afterwards, which is exactly what a verifier meets in the real world.
 */
const fs = require('fs');
const path = require('path');
const { deriveW3C, issuer, signW3C, signW3CPresentation } = require('@trustvc/trustvc');

// `createPresentation`/`signPresentation` are not re-exported by `@trustvc/trustvc`, and
// `@trustvc/w3c-vc` is a transitive dependency rather than a declared one. Resolve it THROUGH
// trustvc so we always load the exact copy trustvc itself uses — otherwise a nested (unhoisted)
// install could sign these fixtures with a different version than the one that verifies them.
const { createPresentation, signPresentation: signPresentationUnchecked } = require(
  require.resolve('@trustvc/w3c-vc', {
    paths: [path.dirname(require.resolve('@trustvc/trustvc'))],
  }),
);

const OUT = __dirname;

const BOL_CONTEXT = [
  'https://www.w3.org/ns/credentials/v2',
  'https://trustvc.io/context/bill-of-lading.json',
];

// Far enough out that the valid presentations never rot.
const FAR_FUTURE = '2999-01-01T00:00:00Z';
// Credential windows. A credential really can have been issued years ago, so fixed dates are
// honest here, and they keep those files byte-stable between runs.
const PAST_FROM = '2020-01-01T00:00:00Z';
const PAST_UNTIL = '2021-01-01T00:00:00Z';
const FUTURE_FROM = '2099-01-01T00:00:00Z';
// Long enough to sign and derive inside, short enough to wait out at the end.
const SHORT_SECONDS = 8;
const HOUR_MS = 60 * 60 * 1000;

// The published trustvc BitstringStatusListCredential (VC 2.0).
// Decoding its bitstring shows indices 5-9 revoked, everything else clear.
const STATUS_LIST = 'https://trustvc.github.io/did/credentials/statuslist/2';
const REVOKED_INDEX = 5;
const revocationEntry = (index) => ({
  id: `${STATUS_LIST}#${index}`,
  type: 'BitstringStatusListEntry',
  statusPurpose: 'revocation',
  statusListIndex: String(index),
  statusListCredential: STATUS_LIST,
});

const written = [];
/**
 * Writes one fixture. `relPath` is the FULL destination relative to this directory
 * (`credentials/rejected/expired.json`), not just a file name — so grepping for a fixture shows
 * where it lands, and a file's folder cannot drift away from the line that writes it.
 */
const write = (relPath, data) => {
  const target = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
  written.push(relPath);
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const embeddedCredential = (vp) =>
  Array.isArray(vp.verifiableCredential) ? vp.verifiableCredential[0] : vp.verifiableCredential;

/**
 * Signs a raw credential. With `pointers` it is derived; without, the BASE credential is
 * returned — `vp-sign` full-discloses an underived credential, which is how a `credentialStatus`
 * stays visible. A narrowly derived one would have that entry stripped and would present
 * cleanly, because there would no longer be anything to check.
 *
 * `deriveW3C` also checks the window, and not even-handedly: an EXPIRED credential only logs
 * "Credential has expired." and derives fine, but one whose `validFrom` is in the future throws.
 * That is why the not-yet-valid credential is left underived.
 */
const signAndDerive = async (raw, keyPair, pointers, suite = 'ecdsa-sd-2023') => {
  const signed = await signW3C(raw, keyPair, suite);
  if (signed.error) throw new Error(`sign (${suite}) failed: ${signed.error}`);
  if (!pointers) return signed.signed;
  const derived = await deriveW3C(signed.signed, pointers);
  if (derived.error) throw new Error(`derive (${suite}) failed: ${derived.error}`);
  return derived.derived;
};

/** The standard bill-of-lading credential, about `subjectDid`, issued by `issuerDid`. */
const bol = (issuerDid, subjectDid, blNumber, extra = {}) => ({
  '@context': BOL_CONTEXT,
  type: ['VerifiableCredential'],
  issuer: issuerDid,
  validFrom: '2024-04-01T12:19:52Z',
  credentialSubject: { id: subjectDid, type: ['BillOfLading'], blNumber },
  ...extra,
});

const REVEAL = ['/credentialSubject/id', '/credentialSubject/blNumber'];

/** Signs a presentation the normal way — every credential is checked before it is presented. */
const present = async (credentials, keyPair, holder, options) => {
  const { signed, error } = await signW3CPresentation(credentials, keyPair, {
    holder,
    ...options,
  });
  if (error) throw new Error(`sign presentation failed: ${error}`);
  return signed;
};

/**
 * Signs a presentation over a credential `present()` would refuse, by building the envelope
 * around one that passes and swapping the bad one in before signing. The proof therefore covers
 * the bad credential and stays VALID — see the header note.
 */
const presentUnchecked = async (
  credential,
  keyPair,
  holder,
  { swapIn, checkHolderBinding = true, ...options } = {},
) => {
  const envelope = await createPresentation(credential, {
    holder,
    version: 'v2',
    fullDisclosure: true,
    ...options,
  });
  if (swapIn) envelope.verifiableCredential = [swapIn];
  const { signed, error } = await signPresentationUnchecked(envelope, keyPair, {
    checkHolderBinding,
  });
  if (error) throw new Error(`sign unchecked presentation failed: ${error}`);
  return signed;
};

const sleepUntil = (iso) => {
  const ms = new Date(iso).getTime() - Date.now() + 1000;
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
};

(async () => {
  // An already-closed presentation window: opened an hour ago, closed half an hour ago. Kept
  // relative to now because a presentation's `validFrom` is stamped at signing time — a fixed
  // 2020 window would describe a presentation nobody could have signed.
  const lapsedFrom = new Date(Date.now() - HOUR_MS).toISOString();
  const lapsedUntil = new Date(Date.now() - HOUR_MS / 2).toISOString();

  // ---------------------------------------------------------------------------------
  // Identities
  // ---------------------------------------------------------------------------------
  const { did: holderDid, didKeyPairs: holderKey } =
    await issuer.generateDidKeyPair('ecdsa-sd-2023');
  const { did: otherDid } = await issuer.generateDidKeyPair('ecdsa-sd-2023');
  const stranger = await issuer.generateDidKeyPair('ecdsa-sd-2023');
  const bbs = await issuer.generateDidKeyPair('bbs-2023');
  // A second BBS identity, used only as an ISSUER for the mixed-suite presentation. Kept
  // separate from `bbs` above, which plays the wrong-suite *holder*, so neither role muddies
  // the other.
  const bbsIssuer = await issuer.generateDidKeyPair('bbs-2023');
  // A did:web that is not published, so its key can never be fetched.
  const ghostKeyPair = await issuer.generateKeyPair({ type: 'ecdsa-sd-2023' });
  const { didKeyPairs: ghostKey } = await issuer.issueDID({
    ...ghostKeyPair,
    domain: 'https://nope.invalid/.well-known/did.json',
  });

  write('keys/holder.json', holderKey);

  // ---------------------------------------------------------------------------------
  // keys/invalid/ — one per reason vp-sign cannot sign with a key
  // ---------------------------------------------------------------------------------
  // What `key-pair-generation` writes: key material with no DID, so there is no holder.
  write('keys/invalid/no_controller.json', await issuer.generateKeyPair({ type: 'ecdsa-sd-2023' }));

  const noSecret = { ...holderKey };
  delete noSecret.secretKeyMultibase;
  write('keys/invalid/missing_secret_key.json', noSecret);

  write('keys/invalid/garbage_key_material.json', {
    ...holderKey,
    publicKeyMultibase: 'zGARBAGEKEYNOTVALID',
    secretKeyMultibase: 'zGARBAGEKEYNOTVALID',
  });

  // Claims the holder's DID and public key, but carries a stranger's private key.
  write('keys/invalid/mismatched_secret_key.json', {
    ...holderKey,
    secretKeyMultibase: stranger.didKeyPairs.secretKeyMultibase,
  });

  // A perfectly good key pair — belonging to somebody who is not the credential subject.
  write('keys/invalid/different_holder.json', stranger.didKeyPairs);

  // Presentation proofs use ecdsa-rdfc-2019, which needs ECDSA (P-256). Pair this with
  // `credentials/rejected/for_bbs_holder.json`: a BBS did:key is a DIFFERENT DID, so with any
  // other credential holder binding fails first and the suite check is never reached.
  write('keys/invalid/wrong_suite_bbs.json', bbs.didKeyPairs);

  // ---------------------------------------------------------------------------------
  // credentials/presentable/ — hand the whole folder to vp-sign
  // ---------------------------------------------------------------------------------
  const vc1 = await signAndDerive(bol(holderDid, holderDid, 'BL-0001'), holderKey, REVEAL);
  const vc2 = await signAndDerive(bol(holderDid, holderDid, 'BL-0002'), holderKey, REVEAL);
  write('credentials/presentable/signed_vc.json', vc1);
  write('credentials/presentable/signed_vc_2.json', vc2);

  // ---------------------------------------------------------------------------------
  // The lapsing credential and its presentations must ALL be signed inside an 8-second window,
  // or `signW3CPresentation` refuses them ("has expired") and this script dies.
  //
  // The clock therefore starts HERE, immediately before the credential that uses it — not at
  // the top of this function. Everything above (seven key generations, two of them BBS, plus
  // the presentable credentials) would otherwise eat into the window before it is ever used.
  // Measured at ~250ms today, so the old placement was not failing, but it silently coupled
  // the window to how much setup happened to sit above it — and that setup has grown twice
  // already. Anchored here, the budget is spent only on the work that actually needs it.
  // ---------------------------------------------------------------------------------
  const lapsesAt = new Date(Date.now() + SHORT_SECONDS * 1000).toISOString();
  const lapsingVc = await signAndDerive(
    bol(holderDid, holderDid, 'BL-LAPSING', { validUntil: lapsesAt }),
    holderKey,
    REVEAL,
  );
  const credentialExpiredVp = await present(lapsingVc, holderKey, holderDid, {
    validUntil: FAR_FUTURE,
  });
  const bothExpiredVp = await present(lapsingVc, holderKey, holderDid, {
    validFrom: lapsedFrom,
    validUntil: lapsedUntil,
  });

  // ---------------------------------------------------------------------------------
  // credentials/rejected/ — one per reason vp-sign refuses a credential
  // ---------------------------------------------------------------------------------
  // Subject is a different DID, so holder binding cannot hold.
  write(
    'credentials/rejected/other_holder.json',
    await signAndDerive(bol(holderDid, otherDid, 'BL-0003'), holderKey, REVEAL),
  );

  // No `credentialSubject.id` AT ISSUANCE — selective disclosure keeps an id that was present
  // when the credential was signed, so this cannot be produced by deriving one away.
  write(
    'credentials/rejected/no_subject_id.json',
    await signAndDerive(
      {
        ...bol(holderDid, holderDid, 'BL-BAD'),
        credentialSubject: { type: ['BillOfLading'], blNumber: 'BL-BAD' },
      },
      holderKey,
      ['/credentialSubject/blNumber'],
    ),
  );

  // Window closed in 2021. Also the bare-credential expiry case for `verify`.
  write(
    'credentials/rejected/expired.json',
    await signAndDerive(
      bol(holderDid, holderDid, 'BL-EXPIRED', { validFrom: PAST_FROM, validUntil: PAST_UNTIL }),
      holderKey,
      [...REVEAL, '/validUntil'],
    ),
  );

  // Window has not opened yet. Left UNDERIVED because deriveW3C throws on a future `validFrom`.
  write(
    'credentials/rejected/not_yet_valid.json',
    await signAndDerive(
      bol(holderDid, holderDid, 'BL-NOTYET', { validFrom: FUTURE_FROM }),
      holderKey,
    ),
  );

  // Revoked on the published status list. Left UNDERIVED so vp-sign full-discloses it and can
  // see the `credentialStatus`.
  write(
    'credentials/rejected/revoked.json',
    await signAndDerive(
      bol(holderDid, holderDid, 'BL-REVOKED', {
        credentialStatus: revocationEntry(REVOKED_INDEX),
      }),
      holderKey,
    ),
  );

  // A transferable record — ownership lives on-chain, so it cannot be presented.
  write(
    'credentials/rejected/transferable_record.json',
    await signAndDerive(
      {
        ...bol(holderDid, holderDid, 'BL-BAD', {
          // `tokenId` is derived by trustvc at signing time and must not be supplied here.
          credentialStatus: {
            type: 'TransferableRecords',
            tokenNetwork: { chain: 'MATIC', chainId: 80002 },
            tokenRegistry: '0x6c2a002A5833a100f38458c50F11E71Aa1A342c6',
          },
        }),
        '@context': [
          ...BOL_CONTEXT,
          'https://trustvc.io/context/transferable-records-context.json',
        ],
      },
      holderKey,
    ),
  );

  // Issued by a did:web that is not published, so its key cannot be fetched to verify it. Reused
  // below for `presentations/invalid/unresolvable_issuer.json` — the same credential, genuinely
  // signed by the ghost key, is what makes that presentation's failure real rather than an edit.
  const ghostIssuedVc = await signAndDerive(
    bol(ghostKey.controller, holderDid, 'BL-GHOST'),
    ghostKey,
    REVEAL,
  );
  write('credentials/rejected/unresolvable_issuer.json', ghostIssuedVc);

  // Edited after signing.
  const tamperedVc = clone(vc1);
  tamperedVc.credentialSubject.blNumber = 'TAMPERED';
  write('credentials/rejected/tampered.json', tamperedVc);

  // Never signed — a raw credential has no proof to check.
  write('credentials/rejected/unsigned.json', bol(holderDid, holderDid, 'BL-RAW'));

  // Valid in itself. It exists to pair with `keys/invalid/wrong_suite_bbs.json`: its subject is
  // the BBS did:key, so holder binding passes and the suite check is actually reached.
  write(
    'credentials/rejected/for_bbs_holder.json',
    await signAndDerive(bol(holderDid, bbs.did, 'BL-BBS'), holderKey, REVEAL),
  );

  // ---------------------------------------------------------------------------------
  // presentations/valid/
  // ---------------------------------------------------------------------------------
  const validVp = await present(vc1, holderKey, holderDid, { validUntil: FAR_FUTURE });
  write('presentations/valid/single_credential.json', validVp);
  write(
    'presentations/valid/multiple_credentials.json',
    await present([vc1, vc2], holderKey, holderDid, { validUntil: FAR_FUTURE }),
  );

  // A presentation carrying credentials signed with DIFFERENT suites — one `ecdsa-sd-2023`, one
  // `bbs-2023` — proving each embedded proof is verified on its own terms. The two axes are
  // independent and it is easy to conflate them:
  //
  //   * the CREDENTIAL proofs can be any supported suite, and can differ from each other;
  //   * the PRESENTATION proof is always `ecdsa-rdfc-2019`, so the HOLDER key must be ECDSA
  //     (P-256) — a BBS holder key cannot sign a presentation at all, which is what
  //     `keys/invalid/wrong_suite_bbs.json` demonstrates.
  //
  // So the BBS credential here is ISSUED BY a separate BBS did:key while its subject is still
  // the ECDSA holder. That is the only arrangement that works, and it happens to be the
  // realistic one: the issuer is a different party from the holder.
  const bbsIssuedVc = await signAndDerive(
    bol(bbsIssuer.did, holderDid, 'BL-BBS-ISSUED'),
    bbsIssuer.didKeyPairs,
    REVEAL,
    'bbs-2023',
  );
  write(
    'presentations/valid/mixed_suites.json',
    await present([vc1, bbsIssuedVc], holderKey, holderDid, { validUntil: FAR_FUTURE }),
  );

  // ---------------------------------------------------------------------------------
  // presentations/invalid/ — one named failure per file
  // ---------------------------------------------------------------------------------
  write(
    'presentations/invalid/presentation_expired.json',
    await present(vc1, holderKey, holderDid, { validFrom: lapsedFrom, validUntil: lapsedUntil }),
  );
  write('presentations/invalid/credential_expired.json', credentialExpiredVp);
  write('presentations/invalid/both_expired.json', bothExpiredVp);

  // Revoked: the one file that cannot be produced by signing normally — see the header.
  const revokedVc = await signAndDerive(
    bol(holderDid, holderDid, 'BL-REVOKED', { credentialStatus: revocationEntry(REVOKED_INDEX) }),
    holderKey,
    REVEAL,
  );
  write(
    'presentations/invalid/credential_revoked.json',
    await presentUnchecked(vc1, holderKey, holderDid, {
      swapIn: revokedVc,
      validUntil: FAR_FUTURE,
    }),
  );

  // No holder proof, so ownership cannot be proven.
  const unsigned = clone(validVp);
  delete unsigned.proof;
  write('presentations/invalid/unsigned.json', unsigned);

  // ONE file for `Invalid signature.` — an embedded credential edited after signing. There used
  // to be a second (`tampered_holder.json`, the `holder` field swapped afterwards) but it
  // produced the identical message, so it demonstrated nothing the reader could see. Any edit to
  // a signed presentation lands here: the credentials AND the `holder` are both inside the signed
  // payload, so tampering with either breaks the proof and stops at this one message.
  const tamperedVp = clone(validVp);
  embeddedCredential(tamperedVp).credentialSubject.blNumber = 'TAMPERED';
  write('presentations/invalid/tampered_credential.json', tamperedVp);

  // Holder binding: the declared holder is NOT the signer, but the signature is genuine. Editing
  // `holder` after signing cannot show this — it just breaks the proof and reports `Invalid
  // signature.` again. Signing with `checkHolderBinding: false` over an envelope that already
  // names somebody else is the only way to reach the binding message with an intact proof, and it
  // is the realistic shape of the attack: presenting a credential that is about someone else.
  write(
    'presentations/invalid/holder_mismatch.json',
    await presentUnchecked(vc1, holderKey, otherDid, {
      checkHolderBinding: false,
      validUntil: FAR_FUTURE,
    }),
  );

  // An embedded credential genuinely ISSUED BY an unpublished did:web, presented with an intact
  // proof. Editing `issuer` on a signed presentation would break the proof and report `Invalid
  // signature.`, hiding the real defect — so the credential is signed by the ghost key for real
  // and swapped in before signing. `signW3CPresentation` refuses it (it verifies every credential
  // first), which is why this goes through the unchecked path.
  write(
    'presentations/invalid/unresolvable_issuer.json',
    await presentUnchecked(vc1, holderKey, holderDid, {
      swapIn: ghostIssuedVc,
      validUntil: FAR_FUTURE,
    }),
  );

  console.log(written.map((n) => `wrote ${n}`).join('\n'));

  // The lapsing files are signed but not yet stale. Wait them out so the folder is in its
  // documented state the moment this returns.
  console.log(`\nwaiting for the short window (${lapsesAt}) to close...`);
  await sleepUntil(lapsesAt);

  console.log(`\nholder: ${holderDid}`);
  console.log(`now:    ${new Date().toISOString()}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
