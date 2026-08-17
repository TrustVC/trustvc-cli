# Verifiable Presentation fixtures

Files for trying `trustvc vp-sign` and `trustvc verify` by hand.

## Generate them first

**Only this README and `generate.cjs` are committed.** The fixtures are generated and gitignored:
they carry throwaway private keys, and **one holder key pair signs everything**, so the set is
only coherent as a whole. There is no regenerating part of it, and every run mints a new holder
DID — never hard-code one anywhere.

```sh
npm run build
node tests/fixtures/vp/generate.cjs
npx prettier --write "tests/fixtures/vp/**/*.json"
```

Run everything from the repository root, against a built CLI. The script pauses ~8s near the end;
that is deliberate, see [Two files that cannot be built by signing](#two-files-that-cannot-be-built-by-signing).

```text
keys/holder.json            the holder key pair — the answer to every key-pair prompt
keys/invalid/               one per reason vp-sign cannot sign with a key            (6)
credentials/presentable/    vp-sign accepts these; hand the WHOLE FOLDER to it       (2)
credentials/rejected/       one per reason vp-sign refuses a credential              (10)
presentations/valid/        verify → all three fragments VALID                       (3)
presentations/invalid/      verify → one named failure per file                      (8)
```

The path tells you the expected outcome: anything under `rejected/` or `invalid/` must fail, and
the file name says how.

The holder is a **did:key**, so its DID comes from its own public key and nothing has to be
hosted. Each credential is self-issued (issuer = holder) purely so the set is self-contained; in
real use the issuer is a different party, which changes nothing, because holder binding only
checks holder = signer = `credentialSubject.id`.

**Four files need network**, because what they demonstrate is a lookup: `credentials/rejected/`
`revoked.json` and `presentations/invalid/credential_revoked.json` fetch a status list, and the
two `unresolvable_issuer.json` files only fail the way they should once DID resolution has been
attempted and failed. Everything else works offline.

## Signing — `vp-sign`

Give the first prompt the **folder**, and both credentials in it are presented:

| Prompt                                                                            | Answer                                      |
| --------------------------------------------------------------------------------- | ------------------------------------------- |
| directory of signed Verifiable Credentials, or path(s) to individual JSON file(s) | `tests/fixtures/vp/credentials/presentable` |
| holder did key-pair JSON file                                                     | `tests/fixtures/vp/keys/holder.json`        |
| How should the presentation expiry be set?                                        | **Enter** (`expiresInSeconds`)              |
| lifetime in seconds                                                               | **Enter** (600)                             |
| directory to save                                                                 | anywhere you like                           |

For a single credential pass `credentials/presentable/signed_vc.json` (`BL-0001`);
`signed_vc_2.json` is `BL-0002`.

The holder DID is read from the key pair — the command prints it rather than asking, since the
signing key's DID _is_ the holder and nothing else could work. It is also what every
`credentialSubject.id` under `presentable/` is set to.

The presentation you produce expires 600 seconds later unless you pick an explicit `validUntil`,
and its `validFrom` is always the moment of signing — see
[A presentation's `validFrom`](#a-presentations-validfrom-is-a-signing-artifact-not-an-input).

## Credentials `vp-sign` must refuse — `credentials/rejected/`

One file per reason, so give the **file**, not the folder — a directory stops at the first
credential it rejects and you would only ever see one message. Every error names the file it came
from, and nothing is written when signing fails.

| File                       | Why it is refused                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `other_holder.json`        | `is about "did:key:zDnaerK7…", which does not match the holder "did:key:zDnaedxx…"`                                                 |
| `no_subject_id.json`       | `has no "credentialSubject.id", so it cannot be bound to the holder.`                                                               |
| `expired.json`             | `has expired (2021-01-01T00:00:00Z).`                                                                                               |
| `not_yet_valid.json`       | `failed to derive credential for full disclosure: The current date time (…) is before the "validFrom" (2099-01-01T00:00:00Z).`      |
| `revoked.json`             | `has been revocation (credentialStatus).` **Network.**                                                                              |
| `transferable_record.json` | `has a "TransferableRecords" credentialStatus and cannot be included in a Verifiable Presentation.` Ownership lives on-chain.       |
| `unresolvable_issuer.json` | `is not valid: Cannot read properties of null (reading 'verificationMethod')` — the issuer's did:web is not published. **Network.** |
| `tampered.json`            | `is not valid: Invalid signature.` A field was edited after signing.                                                                |
| `unsigned.json`            | `each credential must be a signed credential object (with a "proof").`                                                              |
| `for_bbs_holder.json`      | Valid in itself — it exists to pair with `keys/invalid/wrong_suite_bbs.json`.                                                       |

Three are worth knowing about beyond the message:

- **`no_subject_id.json`** had to be issued _without_ a subject id. Selective disclosure keeps a
  `credentialSubject.id` that was present at signing, so you cannot produce this by deriving one
  away.
- **`revoked.json`** is left **underived** on purpose. `vp-sign` full-discloses an underived
  credential, so the `credentialStatus` is visible and the revocation is caught. Derive it
  narrowly and that entry is stripped — the credential then presents and verifies cleanly,
  because there is no longer anything to check. Issuers who care should pass
  `mandatoryPointers: ['/credentialStatus']` when signing.
- **`not_yet_valid.json`** is underived too, but not by choice: `deriveW3C` throws on a credential
  whose `validFrom` is in the future. It is also why this one fails at the _derivation_ step
  rather than the holder-binding step, so its message reads differently from the others.

These double as the bare-credential cases for `verify` — see below.

## Key pairs `vp-sign` must reject — `keys/invalid/`

Give a valid credential (`credentials/presentable/signed_vc.json`) and one of these at the
key-pair prompt. Nothing is written in any of these cases.

| File                         | Result                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no_controller.json`         | `The key pair at … is not bound to a DID (no "controller"). Create one with "trustvc did-web"…` — this is what `key-pair-generation` writes, and the CLI catches it before signing.                                                                                                                                           |
| `missing_secret_key.json`    | `"secretKeyMultibase" property in keyPair is required.`                                                                                                                                                                                                                                                                       |
| `garbage_key_material.json`  | `An ECDSA (P-256) Multikey is required to sign a presentation with "ecdsa-rdfc-2019".`                                                                                                                                                                                                                                        |
| `mismatched_secret_key.json` | Same message. The file claims the holder's DID and public key but carries somebody else's private key, so the pair cannot be loaded — it fails cleanly rather than producing a signature that would not verify.                                                                                                               |
| `different_holder.json`      | `credential at index 0 … is about "did:key:zDnaedxx…", which does not match the holder "did:key:zDnaeV29…"` — a perfectly good key belonging to the wrong person.                                                                                                                                                             |
| `wrong_suite_bbs.json`       | Use it **with `credentials/rejected/for_bbs_holder.json`**, not with `signed_vc.json`. A BBS did:key is a different DID, so any other credential trips holder binding first and the suite is never checked. Paired correctly: `An ECDSA (P-256) Multikey is required … (BBS keys cannot produce a plain presentation proof).` |

## Verifying — `verify`

### `presentations/valid/`

| File                        | Result                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `single_credential.json`    | All three VALID, then `1 embedded credential verified.`                                                                |
| `multiple_credentials.json` | All three VALID, then `2 embedded credentials verified.`                                                               |
| `mixed_suites.json`         | All three VALID, then `2 embedded credentials verified.` — one credential signed `ecdsa-sd-2023`, the other `bbs-2023` |

All are valid until the year 2999, so they will not rot. Their credentials carry no `validUntil`
at all, which is also what shows an absent expiry is not treated as expired-by-default.

**`mixed_suites.json` exists because the two suite questions are easy to conflate.** They are
independent:

|                                    | Suite                          | Constraint                                               |
| ---------------------------------- | ------------------------------ | -------------------------------------------------------- |
| Each embedded **credential** proof | `ecdsa-sd-2023`, `bbs-2023`, … | any supported suite, and they may differ from each other |
| The **presentation** proof         | always `ecdsa-rdfc-2019`       | so the **holder key must be ECDSA (P-256)**              |

A BBS key cannot sign a presentation at all — that is what `keys/invalid/wrong_suite_bbs.json`
demonstrates. So in this fixture the BBS credential is **issued by a separate BBS did:key** while
its subject is still the ECDSA holder. That is the only arrangement that works, and it happens to
be the realistic one: the issuer is a different party from the holder. Holder binding is
unaffected — it only checks `credentialSubject.id` equals the holder, and says nothing about who
issued the credential or with which suite.

```text
vp proof:        ecdsa-rdfc-2019          (holder, ECDSA did:key)
credential [0]:  ecdsa-sd-2023            issuer = holder
credential [1]:  bbs-2023                 issuer = a BBS did:key, subject = holder
```

### `presentations/invalid/`

| File                        | DOCUMENT_INTEGRITY                                                                                                                     | DOCUMENT_STATUS                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `presentation_expired.json` | VALID                                                                                                                                  | **INVALID** — `Presentation has expired (validUntil …)`                                                            |
| `credential_expired.json`   | VALID                                                                                                                                  | **INVALID** — `Embedded credential at index 0 has expired (validUntil …)`                                          |
| `both_expired.json`         | VALID                                                                                                                                  | **INVALID** — the _presentation_ message; it is checked first and short-circuits                                   |
| `credential_revoked.json`   | VALID                                                                                                                                  | **INVALID** — `Embedded credential at index 0 has been revoked (status purpose "revocation")` **Network.**         |
| `unsigned.json`             | **INVALID** — `Presentation is not signed (no holder "proof")…`                                                                        | VALID                                                                                                              |
| `tampered_credential.json`  | **INVALID** — `Invalid signature.`                                                                                                     | VALID                                                                                                              |
| `holder_mismatch.json`      | **INVALID** — `the presentation was signed by "did:key:zDnaesTR…", which does not match the declared holder "did:key:zDnaeUEX…"`       | VALID                                                                                                              |
| `unresolvable_issuer.json`  | **INVALID** — `Embedded credential at index 0 has an invalid signature: Cannot read properties of null (reading 'verificationMethod')` | VALID · also `ISSUER_IDENTITY: INVALID - Could not resolve issuer(s): index 0 (did:web:nope.invalid)` **Network.** |

The split is the point: the first four are **sound signatures over documents that went bad**, so
integrity stays VALID and the failure is a status one. The last four are **broken or unprovable
documents**, so integrity is what fails. A verifier that blurs the two tells users the wrong thing.

**Exactly one file reports the bare `Invalid signature.`** — and that is deliberate. Every edit to
a signed presentation collapses to that message, because the credentials _and_ the `holder` are
both inside the signed payload, so tampering with any of them breaks the proof and stops there.
Three fixtures used to say it, which meant two of them demonstrated nothing a reader could see.
The other two now reach their real failure instead:

- **`holder_mismatch.json`** is signed with `checkHolderBinding: false` over an envelope that
  already names somebody else, so the signature is genuine and the **binding** check is what
  fails. Swapping `holder` after signing cannot show this — it only breaks the proof. This is also
  the realistic shape of the attack: presenting a credential that is about someone else.
- **`unresolvable_issuer.json`** embeds a credential _genuinely issued by_ the unpublished
  did:web (the same one as `credentials/rejected/unresolvable_issuer.json`), swapped in before
  signing. The holder proof is intact, so the report names the embedded credential instead of a
  generic `Invalid signature.` that reads like tampering.

  **Its integrity failure is unavoidable, and its wording is an upstream wart.**
  `Cannot read properties of null (reading 'verificationMethod')` is a raw `TypeError` leaking
  through, not a written message: resolution returned `null` and the code dereferenced it. It
  always means a DID could not be resolved. The fragment cannot pass either way — verifying the
  credential's signature needs the issuer's public key, which is exactly what could not be
  fetched, so "unverifiable" is being reported as "invalid". Both are worth knowing about
  precisely because a verifier UI will hit this exact string.

### Bare credentials, no presentation

`verify` takes a plain VC too, and the files under `credentials/` double as those cases:

| File                          | Result                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `presentable/signed_vc.json`  | All three VALID                                                                                                                                                             |
| `rejected/expired.json`       | All three **VALID**, plus a `The document credential has expired.` warning line ⚠️                                                                                          |
| `rejected/not_yet_valid.json` | `DOCUMENT_INTEGRITY: INVALID - The current date time (…) is before the "validFrom" (…)` and `DOCUMENT_STATUS: INVALID - Document is not a valid SignedVerifiableCredential` |

Two oddities live here, both upstream in `@trustvc/w3c-vc`'s `_checkCredential`:

- **An expired standalone credential does not fail any fragment.** It only `console.warn`s, which
  the CLI surfaces as that warning line. Anything routing on fragments alone accepts it.
- **A not-yet-valid one reports the same problem twice, and the second message lies.**
  `_checkCredential` _throws_ for a future `validFrom` (where expiry only warns — same window,
  opposite edges, opposite severity). `isSignedDocument` runs the very same function inside a
  `try/catch`, turns that throw into a bare `false`, and the empty-status fragment renders it as
  `Document is not a valid SignedVerifiableCredential`. The document _is_ a valid signed VC; that
  is a shape complaint standing in for a date complaint. Being underived has nothing to do with
  it — deriving the same credential with the clock faked into its window gives identical output.

### Getting `ISSUER_IDENTITY: INVALID`

`presentations/invalid/unresolvable_issuer.json` covers the realistic case — a credential whose
issuer DID no longer resolves. To produce the other two, edit a copy of
`presentations/valid/single_credential.json`:

| Edit to the embedded credential    | Message                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| `issuer` set to an unpublished DID | `Could not resolve issuer(s): index 0 (did:web:nope.invalid).` |
| `issuer` deleted                   | `1 embedded credential(s) have no issuer.`                     |
| `verifiableCredential` set to `[]` | `Presentation contains no verifiable credentials.`             |

**`DOCUMENT_INTEGRITY` goes INVALID alongside all three**, and that is not a flaw. Verifying an
embedded credential's own signature needs the issuer's public key — exactly what could not be
fetched — so an unresolvable issuer necessarily fails integrity too. The difference is in the
_message_: the shipped fixture reports `Embedded credential at index 0 has an invalid signature:
Cannot read properties of null (reading 'verificationMethod')`, which names the real cause,
whereas the two hand-edited variants above report a bare `Invalid signature.`, because editing a
signed presentation breaks the holder proof before anything else is reached.

A correctly signed presentation cannot carry an unresolvable issuer through the normal path —
`vp-sign` verifies every credential before presenting it, which is why the fixture is built with
`signPresentation` directly.

## Two files that cannot be built by signing

`signW3CPresentation` refuses to present a credential that is expired, not yet valid, or revoked.
The obvious shortcut does not work either: swapping a bad credential into an already-signed
presentation breaks the holder proof, and the result reports `DOCUMENT_INTEGRITY: INVALID -
Invalid signature.` — indistinguishable from tampering, and saying nothing about why the
credential is bad. So two files take a different route.

**`credential_expired.json` (and `both_expired.json`) let the clock do it.** They are signed over
a credential with an 8-second lifetime, and the generator waits it out before returning. The proof
stays intact forever while the credential is permanently expired. That is the pause you see.

**`credential_revoked.json` uses the check/no-check split in `@trustvc/w3c-vc`.** Revocation has
no window to wait out — the bit lives on a status list we do not control, so it never flips after
signing. But `createPresentation` runs the credential checks while **`signPresentation` runs
none**; it signs whatever envelope it is handed. So the generator builds the envelope around a
credential that passes, swaps the revoked one in, and _then_ signs. The proof covers the revoked
credential and integrity comes back VALID — correctly, because this is not a tampered document, it
is a correctly signed presentation of something revoked afterwards.

Two things that will bite if you rebuild that one by hand:

- **Derive the credential first.** Embedding an ecdsa-sd _base_ credential gives
  `DOCUMENT_INTEGRITY: INVALID - … base credentials must be derived before verification`, which
  masks the revocation completely. `/credentialStatus` is a mandatory pointer since 2.15.1, so it
  survives derivation whatever pointers you name.
- **`@trustvc/w3c-vc` is a transitive dependency, not a declared one.** `generate.cjs` resolves it
  _through_ `@trustvc/trustvc` rather than by bare name, so it always loads the exact copy trustvc
  itself uses — otherwise a nested install could sign the fixture with a different version than
  the one verifying it.

It uses **`BitstringStatusListEntry`** against
`https://trustvc.github.io/did/credentials/statuslist/2`, the VC 2.0 bitstring list, which is also
what this repo's `credential-status create` emits. Decoding that list shows **indices 5-9 revoked**
and everything else clear, so index 5 is the revoked one and any other index yields a live
credential. `BitstringStatusListEntry` is defined in the VC 2.0 context already, so unlike the
older `StatusList2021Entry` (on `statuslist/1`) it needs no extra `@context`.

## A presentation's `validFrom` is a signing artifact, not an input

**You cannot make a presentation without one, and you cannot choose it through the CLI.**
`resolveVpValidity` in `@trustvc/w3c-vc` defaults it to the signing moment
(`options?.validFrom ?? now.toISOString()`), and `createPresentation` writes it onto every
document unconditionally — `validFrom`/`validUntil` under a VC 2.0 context, `issuanceDate`/
`expirationDate` under 1.1. Deleting it afterwards is not an option either: it is inside the
signed payload, so a stripped document reports `DOCUMENT_INTEGRITY: INVALID - Invalid signature.`

`vp-sign` only asks how the window should _close_ — `expiresInSeconds` (default 600) or an
explicit `validUntil`, which the prompt validates as being in the future. Measured end to end: a
CLI run started at `04:35:03Z` produced `validFrom: 2026-08-16T04:35:05.218Z`.

So **there is no not-yet-valid presentation fixture** — no honest document can have one. Only
`validUntil` bounds a presentation in practice.

**`credentials/rejected/not_yet_valid.json` is a different thing and does exist.** A _credential's_
`validFrom` is chosen by its issuer and genuinely can sit in the future, so that case is real,
refused by `vp-sign`, and caught by `verify`. A _presentation's_ is stamped at signing. Same field
name, two different origins — the credential file is not a leftover of the removed presentation
scenario.

The expired presentations are the one place
`validFrom` is passed explicitly, and there it is **required, not decoration**: it defaults to now
and trustvc rejects a window that closes before it opens, so a past `validUntil` alone is refused
with `"validUntil" (…) must be a valid time after "validFrom" (<now>)`. Those windows are kept
relative to now — opened an hour ago, closed half an hour ago — because a fixed 2020 date would
describe a presentation nobody could have signed.

## Every file holds one fixed state

Nothing here changes state after the generator exits, so a file named for its state always _is_
in that state. There is deliberately no "expires in N seconds" fixture: it reported VALID or
INVALID depending on how long after generating it you opened it, and in practice was always found
already expired. Watching a document go VALID → INVALID is a test's job —
`tests/commands/w3c/vp.integration.test.ts` does it with a faked clock, in about a second, with no
fixture at all. `expiresInSeconds` has no fixture either: it only computes `validUntil` from now,
so the signed output is indistinguishable from an explicit one.

## What is automated, and what these files are for

Every scenario here is also covered by `tests/commands/w3c/vp.integration.test.ts`, which mints
its own presentations rather than reading this folder — a stored presentation carries a real
expiry and would start failing on its own. So **nothing automated reads these files**, and
regenerating them can never break the suite.

Four `vp-sign` refusals are fixture-only, with no automated test: revoked, transferable record,
missing `credentialSubject.id`, and the BBS/wrong-suite pair. They work, but nothing catches a
regression.

**So these files exist for what a test cannot do**: handing a real document to a verifier UI, the
trustvc website, or another implementation, and reading the message a human would see. That is
where the presentation-vs-credential distinction actually gets lost — `credential_expired.json`
and `presentation_expired.json` land on the same fragment, so the **message** is all that
separates them, and they need opposite remedies. An expired presentation means the holder should
re-present; an expired credential means the **issuer** must reissue. Re-presenting can never fix
the second, so a UI that collapses both into "ask the holder to present again" sends users down a
dead end.

## Editing them

Don't — these carry real signatures over real timestamps, so any hand edit invalidates the proof.
Change `generate.cjs` and re-run it instead.
