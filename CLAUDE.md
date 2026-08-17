# CLAUDE.md

Guidance for working in this repo — for human developers and for Claude Code.

> **Keep this file alive.** It's only useful if it stays true. Treat it as part of the
> code: when a change makes something here wrong or incomplete, update it _in the same
> commit/PR_. See [Maintaining this file](#maintaining-this-file).

## What this repo is

`@trustvc/trustvc-cli` is the **interactive command-line front end** to
[`@trustvc/trustvc`](https://github.com/TrustVC/trustvc). It owns no cryptography and no
chain logic — every command is prompts + file I/O around a library call. When something is
wrong with a signature, a proof or a verification result, the bug is almost always upstream
in `trustvc` (or `@trustvc/w3c-vc` below it), not here.

```text
src/main.ts          yargs entry point; auto-registers every command under src/commands/
src/commands/        one file per command — see "Adding a command"
src/utils/           file I/O, networks, wallets, formatting, prompts (barrel: utils/index.ts)
src/types.ts         shared input types for command handlers
tests/fixtures/      documents to run commands against
```

Each command file exports `command`, `describe` and `handler`; `main.ts` picks them up with
`commandDir(..., { recurse: true })`. A nested folder becomes a **command group** only if it
has an `index.ts` declaring one (`wallet <method>`, `document-store <method>`); otherwise the
files register flat, which is why `src/commands/w3c/sign.ts` is `trustvc w3c-sign`.

## Commands

Node **≥ 22** — enforced at runtime in `main.ts`, and the install fails below it.
Use `nvm use 22`.

```bash
npm run build            # tsup -> dist/ (run before testing the real CLI)
node dist/main.js <cmd>  # run a command; `npm link` if you want a global `trustvc`
npm test                 # vitest --run
npm run lint             # eslint, --max-warnings=0
npm run format:check     # prettier, same set CI checks

npx vitest --run tests/commands/w3c/vp-sign.test.ts          # one file
npx vitest --run <file> -t "does not match the holder"       # one test
```

**Before "done": `npm run lint` AND `npm run format:check`.** CI runs lint → format:check →
test → build, and `lint` is `--max-warnings=0`, so a single warning is a red build.

**`tsc --noEmit` is NOT a gate and will never be clean** — `node_modules/@tradetrust-tt/
token-registry-v4` ships `.ts` sources that don't compile against ethers v6, and several
`src/commands/**` files have pre-existing ethers v5/v6 signature mismatches. To check your
own work, filter: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep <your-file>`.

**Some tests hit the network** (did:web resolution, StatusList fetches, RPC). They're real
integration checks — don't mock them away.

## Testing an interactive command for real

Every command is prompt-driven, so piping stdin does **not** work — inquirer needs a TTY and
exits with `User force closed the prompt`. Use `expect`:

```tcl
set timeout 90
spawn node dist/main.js vp-sign
expect "path(s) to individual JSON file"
send "tests/fixtures/vp/credentials/presentable\r"
expect "key-pair JSON file"
send "tests/fixtures/vp/keys/holder.json\r"
expect eof
```

Strip the ANSI redraw noise from the output: `| perl -pe 's/\e\[[0-9;?]*[a-zA-Z]//g; s/\r//g'`.
Keep answers short — long absolute paths make the prompt line-wrap, and an `expect` pattern
that straddles the wrap never matches, which looks like a hang.

## Verifiable Presentations

`vp-sign` creates and signs a presentation; `verify` verifies it, along with every other
document type. There is deliberately **no `vp-verify`** — one verify command for everything.

- **The credentials prompt takes a directory**, a file, or comma-separated files. A directory
  presents **every file in it**, unfiltered: anything that isn't a presentable credential is
  reported by the signing step, which names the file (`nameFailingCredential` rewrites
  trustvc's "credential at index 2" using the paths). Dot-files and sub-directories are
  skipped — OS noise, never a credential.
- **The holder DID is not prompted.** trustvc enforces that the signing key's DID _is_ the
  holder, so any other answer could only fail. It's read from the key pair and printed. A key
  pair with no `controller` (the bare `keypair.json` from `key-pair-generation`) is rejected
  up front — presentations need the `didKeyPairs.json` that `did-web` writes.
- **No challenge support.** An anti-replay challenge can only be checked by the verifier that
  issued it, and `verify` has no way to take one, so every presentation gets an
  `assertionMethod` proof.
- A valid presentation prints one extra line — `N embedded credentials verified.` — because
  the three fragment lines read identically over one credential or five. Failures keep the
  plain three-line output.

- **Every presentation temporal failure belongs on `DOCUMENT_STATUS`.**
  Both an expired presentation and an expired embedded credential report there now
  (`Presentation has expired (validUntil …)` / `Embedded credential at index 0 has expired
(validUntil …)`), with `DOCUMENT_INTEGRITY` correctly VALID, since the signature is sound in
  both. When both windows are closed the presentation's message wins — it is checked first and
  short-circuits.
- **A presentation's `validFrom` is a signing artifact, not an input — don't treat it as a
  window a user controls.** `resolveVpValidity` in `@trustvc/w3c-vc` defaults it to the signing
  moment (`options?.validFrom ?? now.toISOString()`) and `createPresentation` writes it
  unconditionally, so every VP has one and none can be made without it. It cannot be stripped
  afterwards either — it is inside the signed payload, so removing it gives
  `DOCUMENT_INTEGRITY: INVALID - Invalid signature.` `vp-sign` only asks how the window
  _closes_ (`expiresInSeconds`, default 600, or an explicit future `validUntil`), so through the
  CLI the window always opens now. Hence no not-yet-valid _presentation_ case exists or is tested;
  only `validUntil` bounds a presentation. Passing an explicit past `validFrom` is required to
  build an already-expired presentation, because a past `validUntil` alone trips
  `"validUntil" (…) must be a valid time after "validFrom" (<now>)`.
  **A not-yet-valid CREDENTIAL is a different matter and is covered** —
  `tests/fixtures/vp/credentials/rejected/not_yet_valid.json`. A credential's `validFrom` is
  chosen by its issuer and can genuinely sit in the future; a presentation's is stamped at
  signing. Same field name, two different origins — don't delete the credential fixture thinking
  it is a leftover of the presentation case.
- **An expired _standalone_ credential reports three VALID fragments** plus a
  `The document credential has expired.` warning line — the warning is the only signal, so
  anything routing on fragments alone accepts it.
- **Credential suite and presentation suite are independent.** Embedded credentials may use any
  supported suite and may differ from each other (`presentations/valid/mixed_suites.json` carries
  one `ecdsa-sd-2023` and one `bbs-2023`, and verifies fully VALID). The presentation proof is
  always `ecdsa-rdfc-2019`, so only the **holder** key must be ECDSA (P-256) — a BBS key cannot
  sign a presentation. A BBS-issued credential therefore needs a separate BBS issuer DID with the
  ECDSA holder as its subject; holder binding only checks `credentialSubject.id`, never the
  issuer or the suite.
- **`createPresentation` checks credentials; `signPresentation` does not.** The `@trustvc/w3c-vc`
  pair is split that way, and it is the only way to build a presentation of a REVOKED credential
  — `signW3CPresentation` refuses one, and revocation has no window to wait out since the bit
  lives on a status list we do not control. Build the envelope around a credential that passes,
  swap the revoked one in, then sign: the proof covers it and `DOCUMENT_INTEGRITY` stays VALID,
  which is correct (revoked afterwards ≠ tampered). Derive the credential first — an embedded
  ecdsa-sd _base_ credential fails integrity for an unrelated reason and masks the revocation.
  Neither function is re-exported by `@trustvc/trustvc`, and `@trustvc/w3c-vc` is transitive, so
  resolve it _through_ trustvc to guarantee the same copy signs and verifies.
- **Use `BitstringStatusListEntry`, not `StatusList2021Entry`**, for new status fixtures — it is
  what `credential-status create` emits and needs no extra `@context` (VC 2.0 defines it).
  Published lists: `trustvc.github.io/did/credentials/statuslist/2` is the bitstring one
  (indices 5-9 revoked), `/1` is the older 2021 list.
- **You cannot fake an out-of-window credential inside a presentation.**
  `signW3CPresentation` refuses to present one (by design), and swapping a bad credential into
  an already-signed presentation breaks the holder proof — you get
  `DOCUMENT_INTEGRITY: INVALID - Invalid signature.`, which proves nothing about expiry. The
  only honest route is a short real window that lapses on its own, which is what
  `tests/fixtures/vp/generate.cjs` does (and why it pauses ~8s), with every result baselined in
  that folder's README.
- **`deriveW3C` treats the two window edges differently.** An expired credential only logs
  `Credential has expired.` and derives fine; a `validFrom` in the future throws. So a
  not-yet-valid credential can only be left underived — but that is not why its
  `DOCUMENT_STATUS` message is odd; see the standalone-credential note in the fixtures README.
- **A presentation cannot be unbounded** — trustvc requires `expiresInSeconds` or `validUntil`.
  A credential with no `validUntil` is fine and is not treated as expired.

`verify` routes on shape via `isVerifiablePresentation()` (type includes
`VerifiablePresentation` **and** a `verifiableCredential` field). It deliberately ignores
`proof`, so an unsigned presentation is routed in and reported INVALID rather than skipped.

## Gotchas (hard-won — add to this list)

- **`.gitignore` entries for command output are anchored (`/didKeyPairs.json`) on purpose.**
  Unanchored, those names match at _any_ depth and silently swallow the identically-named
  files under `tests/fixtures/`. Adding a bare `signed_vp.json` would quietly drop a fixture
  from the next commit. If you add a command that writes a default filename, anchor it.
- **`tests/commands/verify.test.ts` walks `tests/fixtures/verify/` recursively** and verifies
  every JSON it finds. Anything you drop in there becomes a test case. Never put a
  presentation there — a VP always carries an expiry and would start failing on its own.
- **VP tests mint their own presentations at runtime** for the same reason. Nothing
  automated reads `tests/fixtures/vp/`. The temporal cases in `vp.integration.test.ts` move a
  **faked `Date`** (`vi.useFakeTimers({ toFake: ['Date'] })`, so real awaits still resolve)
  instead of sleeping, and every window is relative to now, so they are fast and never rot.
  Signing still happens at the real clock — `signW3CPresentation` refuses to present an
  already-expired credential, so a lapsed one can only be built by signing first and moving
  the clock afterwards.
- **If you ever pin a known upstream gap with `it.fails`, check it fails on its assertion and
  not on a setup error** — `it.fails` passes on _any_ throw, so a broken test looks identical to
  a correctly-pinned gap and can never go red. Flip it to a plain `it`, confirm the failure
  message is the assertion you meant, then flip it back.
- **`tests/fixtures/vp/` is generated and gitignored** — only `generate.cjs` and `README.md` are
  tracked, so the folder is empty on a fresh clone. Run `node tests/fixtures/vp/generate.cjs`
  before testing a command by hand. The set is all-or-nothing: ONE holder key pair signs
  everything, so you cannot regenerate part of it, and each run produces a new holder DID.
  It is laid out by what a document IS, so a file's kind and its expected outcome are both
  readable from its path: `keys/` (+ `keys/invalid/`), `credentials/presentable|rejected/`,
  `presentations/valid|invalid/`. Anything under `rejected/` or `invalid/` must fail, and the
  file name says how.
- **1–3 `bbs2023`/`ecdsa` fixtures in `verify.test.ts` time out under full-suite load.**
  Pre-existing: BBS verification is slow and vitest's default timeout is 5s. It varies run to
  run. `npx vitest --run tests/commands/verify.test.ts -t bbs2023` passes in isolation.
- **`main.ts` sets `process.noDeprecation = true`.** Transitive deps (`node-fetch@2` →
  `whatwg-url` → `tr46`, and `jsonld@4` → `request` → `tough-cookie`) still require Node's
  deprecated `punycode`, and the warning printed mid-prompt garbled the interactive display.
- **`@trustvc/trustvc` does not export the presentation types.** It exports
  `signW3CPresentation`/`verifyW3CPresentation` but not `SignedVerifiablePresentation`, so
  `src/types.ts` derives it from the function signature. Delete that alias and import
  directly once the library exports it.
- **`Cannot read properties of null (reading 'verificationMethod')`** always means a DID could
  not be resolved — nearly always a did:web whose document isn't published yet.

## Adding a command

1. Create `src/commands/<area>/<name>.ts` exporting `command`, `describe`, `handler`.
2. Keep the prompt flow in an exported `promptForInputs()` and the work in a second exported
   function. Tests mock `@inquirer/prompts` and call the two separately — a handler that does
   both inline can't be tested.
3. Add the input type to `src/types.ts`.
4. Wrap the handler body in try/catch and report via `signale.error`.
5. Document it in `README.md`: the Quick Start block, the command table, and a
   `<details>` section in the Detailed Command Reference.

## Conventions

- Conventional commits (semantic-release drives versioning and the CHANGELOG).
- Prompts use `@inquirer/prompts`; user-facing output goes through `signale`, never
  `console.log` (except deliberate blank spacer lines).
- Read and write files through `src/utils/file-io.ts` — it handles path validation and
  parent-directory creation.
- Don't add a prompt whose only correct answer is the default. See the holder-DID note above.

## Maintaining this file

**Documentation-as-code. Keep it in sync in the same change that makes it stale — not
"later".** Update this file when your change touches:

- **A command's prompts, name, or output shape** — including anything the README documents.
- **A gotcha you just spent time on** — new gotchas are the highest-value additions.
- **The dependency on `@trustvc/trustvc`**, when its behaviour changes what commands produce.
- **Tooling, CI gates, or the Node requirement** — keep the Commands section runnable.

Small-and-true beats big-and-stale; delete guidance that no longer holds. Keep it
repo-specific: anything true of every Node CLI doesn't belong here.

**For Claude Code specifically:** at the end of a task that changed any of the above, check
whether this file is now inaccurate and propose the edit as part of the same work — don't
wait to be asked.
