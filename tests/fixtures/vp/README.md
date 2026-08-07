# Verifiable Presentation fixtures

Files for trying `trustvc vp-sign` and `trustvc verify` by hand.

## Generate them first

**Only this README and `generate-fixtures.cjs` are committed.** The fixtures themselves are
generated and gitignored: they carry throwaway private keys, and every credential and
presentation is bound to the one holder key pair, so the set is only coherent as a whole —
there is no regenerating part of it.

```sh
npm run build
node tests/fixtures/vp/generate-fixtures.cjs
npx prettier --write "tests/fixtures/vp/**/*.json"
```

That writes:

```
credentials/          → hand this WHOLE FOLDER to vp-sign
invalid-credentials/  → one file per reason vp-sign refuses a credential (pass ONE at a time)
invalid-keypairs/     → one file per reason vp-sign cannot sign with a key
presentations/        → inputs for verify
didKeyPairs.json      → the holder's key pair
```

Re-run it after bumping `@trustvc/trustvc`: these are signed artifacts and keep whatever
issuance rules produced them. Each run mints fresh keys, so the holder DID changes — never
hard-code it anywhere.

Everything here is **did:key** based: the holder's DID is derived from its own public key, so
nothing has to be hosted and every fixture verifies offline. Each credential is self-issued
(issuer = holder) purely so the set is self-contained — in real use the issuer is a different
party, which is fine: holder binding only checks holder = signer = `credentialSubject.id`.

Run the commands from the repository root, against a built CLI:

```sh
npm run build
node dist/main.js vp-sign     # or `trustvc vp-sign` if you have npm link'ed
node dist/main.js verify
```

## Signing — `vp-sign`

Give the first prompt the **folder**, and both credentials in it are presented:

```
tests/fixtures/vp/credentials
```

| Prompt | Answer |
| --- | --- |
| directory of signed Verifiable Credentials, or path(s) to individual JSON file(s) | `tests/fixtures/vp/credentials` |
| holder did key-pair JSON file | `tests/fixtures/vp/didKeyPairs.json` |
| presentation expiry | **Enter** (seconds from now) |
| lifetime in seconds | **Enter** (600) |
| directory to save | anywhere you like |

For a single credential, pass `tests/fixtures/vp/credentials/signed_vc.json` (`BL-0001`)
instead; `signed_vc_2.json` is `BL-0002`.

The holder DID is read from the key pair — the command prints it rather than asking, since
the signing key's DID *is* the holder and nothing else could work. It is also what every
`credentialSubject.id` in `credentials/` is set to; the generator mints the key pair and the
credentials together so they always agree.

## Credentials `vp-sign` must refuse — `invalid-credentials/`

One file per reason, so give the **file**, not the folder — a directory stops at the first
credential it rejects, and you would only ever see one message. Every error names the file it
came from, and nothing is written when signing fails.

| File | Why it is refused |
| --- | --- |
| `other_holder.json` | `is about "did:key:zDnaerUv…", which does not match the holder "did:key:zDnaer6t…"` |
| `no_subject_id.json` | `has no "credentialSubject.id", so it cannot be bound to the holder.` |
| `expired.json` | `has expired (2021-01-01T00:00:00Z).` |
| `revoked.json` | `has been revocation (credentialStatus).` |
| `transferable_record.json` | `has a "TransferableRecords" credentialStatus and cannot be included in a Verifiable Presentation.` Ownership lives on-chain. |
| `unresolvable_issuer.json` | `is not valid: Cannot read properties of null (reading 'verificationMethod')` — the issuer's did:web is not published, so its key cannot be fetched. |
| `tampered.json` | `is not valid: Invalid signature.` A field was edited after signing. |
| `unsigned.json` | `each credential must be a signed credential object (with a "proof").` |
| `for_bbs_holder.json` | Valid in itself — it exists to pair with `invalid-keypairs/wrong_suite_bbs.json`. Its subject is the BBS did:key, so holder binding passes and the suite check is reached. |

Two of these are worth knowing about beyond the message:

- **`no_subject_id.json`** had to be issued *without* a subject id. Selective disclosure keeps
  a `credentialSubject.id` that was present at signing, so you cannot produce this by deriving
  one away.
- **`revoked.json`** is left **underived** on purpose. `vp-sign` full-discloses an underived
  credential, so the `credentialStatus` is visible and the revocation is caught. Derive it
  narrowly and that entry is stripped — the credential then presents and verifies cleanly,
  because there is no longer anything to check. Issuers who care should pass
  `mandatoryPointers: ['/credentialStatus']` when signing.

Note the presentation you produce expires 600 seconds later, unless you pick an explicit
`validUntil`.

## Key pairs `vp-sign` must reject — `invalid-keypairs/`

Give a valid credential (`credentials/signed_vc.json`) and one of these at the key-pair
prompt. Nothing is written in any of these cases.

| File | Result |
| --- | --- |
| `no_controller.json` | `The key pair at … is not bound to a DID (no "controller"). Create one with "trustvc did-web"…` — this is what `key-pair-generation` writes, and the CLI catches it before signing. |
| `missing_secret_key.json` | `"secretKeyMultibase" property in keyPair is required.` |
| `garbage_key_material.json` | `An ECDSA (P-256) Multikey is required to sign a presentation with "ecdsa-rdfc-2019".` |
| `mismatched_secret_key.json` | Same message. The file claims the holder's DID and public key but carries somebody else's private key, so the pair cannot be loaded — it fails cleanly rather than producing a signature that would not verify. |
| `different_holder.json` | `credential at index 0 … is about "did:key:zDnaeb…", which does not match the holder "did:key:zDnaeS…"` — a perfectly good key belonging to the wrong person. |
| `wrong_suite_bbs.json` | Use it **with `invalid-credentials/for_bbs_holder.json`**, not with `credentials/signed_vc.json`. A BBS did:key is a different DID, so any other credential trips holder binding first and the suite is never checked. Paired correctly: `An ECDSA (P-256) Multikey is required … (BBS keys cannot produce a plain presentation proof).` |

## Verifying — `verify`

| File in `presentations/` | Expected result |
| --- | --- |
| `signed_vp.json` | All three VALID, then `1 embedded credential verified.` Valid until the year 2999, so it will not rot. |
| `signed_vp_multi.json` | All three VALID, then `2 embedded credentials verified.` |
| `expired_vp.json` | `DOCUMENT_STATUS: INVALID - Presentation has expired (validUntil 2020-01-02T00:00:00Z).` Integrity stays VALID: the signature is sound, the window has simply closed. |
| `unsigned_vp.json` | `DOCUMENT_INTEGRITY: INVALID - Presentation is not signed (no holder "proof"), so ownership cannot be proven.` |
| `tampered_vp.json` | `DOCUMENT_INTEGRITY: INVALID - Invalid signature.` An embedded credential was edited (`blNumber` → `TAMPERED`) after signing. |
| `tampered_holder_vp.json` | `DOCUMENT_INTEGRITY: INVALID - Invalid signature.` The `holder` field was swapped to another DID after signing. `holder` is part of the signed payload, so this breaks the proof itself rather than reporting a holder-binding message. |
| `unresolvable_issuer_vp.json` | `ISSUER_IDENTITY: INVALID - Could not resolve issuer(s): did:web:nope.invalid.` — plus `DOCUMENT_INTEGRITY: INVALID`, see below. |

### Getting `ISSUER_IDENTITY: INVALID`

The fragment fails in three ways, and `unresolvable_issuer_vp.json` covers the realistic one
— a credential whose issuer DID no longer resolves. To produce the other two, edit a copy of
`signed_vp.json`:

| Edit to the embedded credential | Message |
| --- | --- |
| `issuer` set to an unpublished DID | `Could not resolve issuer(s): did:web:nope.invalid.` |
| `issuer` deleted | `1 embedded credential(s) have no issuer.` |
| `verifiableCredential` set to `[]` | `Presentation contains no verifiable credentials.` |

**`DOCUMENT_INTEGRITY` always goes INVALID too**, and that is not a flaw in the fixture. The
embedded credentials are inside the signed payload, so editing one breaks the holder proof;
and verifying that credential's own signature needs the issuer's public key, which is exactly
what could not be fetched. A correctly signed presentation cannot carry an unresolvable
issuer in the first place — `vp-sign` verifies every credential before presenting it, so it
refuses to build one.

## Editing them

Don't — the presentations carry real signatures over real timestamps, so any hand edit
invalidates the proof. Change `generate-fixtures.cjs` and re-run it instead
(see [Generate them first](#generate-them-first)).

Nothing automated reads these files: `tests/commands/verify.test.ts` only walks
`tests/fixtures/verify/`, and the VP tests mint their own presentations at runtime because a
stored one would eventually expire. They exist purely for manual testing.
