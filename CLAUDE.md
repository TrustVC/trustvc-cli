# CLAUDE.md

Guidance for working in this repo — for human developers and for Claude Code.

> **Keep this file alive.** It's only useful if it stays true. Treat it as part of the
> code: when a change makes something here wrong or incomplete, update it *in the same
> commit/PR*. See [Maintaining this file](#maintaining-this-file).

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
send "tests/fixtures/vp/credentials\r"
expect "key-pair JSON file"
send "tests/fixtures/vp/didKeyPairs.json\r"
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
- **The holder DID is not prompted.** trustvc enforces that the signing key's DID *is* the
  holder, so any other answer could only fail. It's read from the key pair and printed. A key
  pair with no `controller` (the bare `keypair.json` from `key-pair-generation`) is rejected
  up front — presentations need the `didKeyPairs.json` that `did-web` writes.
- **No challenge support.** An anti-replay challenge can only be checked by the verifier that
  issued it, and `verify` has no way to take one, so every presentation gets an
  `assertionMethod` proof.
- A valid presentation prints one extra line — `N embedded credentials verified.` — because
  the three fragment lines read identically over one credential or five. Failures keep the
  plain three-line output.

`verify` routes on shape via `isVerifiablePresentation()` (type includes
`VerifiablePresentation` **and** a `verifiableCredential` field). It deliberately ignores
`proof`, so an unsigned presentation is routed in and reported INVALID rather than skipped.

## Gotchas (hard-won — add to this list)

- **`.gitignore` entries for command output are anchored (`/didKeyPairs.json`) on purpose.**
  Unanchored, those names match at *any* depth and silently swallow the identically-named
  files under `tests/fixtures/`. Adding a bare `signed_vp.json` would quietly drop a fixture
  from the next commit. If you add a command that writes a default filename, anchor it.
- **`tests/commands/verify.test.ts` walks `tests/fixtures/verify/` recursively** and verifies
  every JSON it finds. Anything you drop in there becomes a test case. Never put a
  presentation there — a VP always carries an expiry and would start failing on its own.
- **VP tests mint their own presentations at runtime** for the same reason. Nothing
  automated reads `tests/fixtures/vp/`.
- **`tests/fixtures/vp/` is generated and gitignored** — only `generate-fixtures.cjs` and
  `README.md` are tracked, so the folder is empty on a fresh clone. Run
  `node tests/fixtures/vp/generate-fixtures.cjs` before testing a command by hand. The set is
  all-or-nothing: every credential and presentation is bound to the one holder key pair it
  mints, so you cannot regenerate part of it, and each run produces a new holder DID.
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
- **`w3c-sign` output changed in trustvc 2.15.1.** `@trustvc/w3c-vc` 2.4.2 made
  `/credentialStatus`, `/validUntil` and `/expirationDate` mandatory pointers, so a holder can
  no longer selectively disclose a revocation entry or an expiry away. Credentials signed by
  older versions are still strippable and must be reissued. Regenerate the VP fixtures after
  bumping trustvc — they're signed artifacts and keep whatever rules produced them.
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
