# TrustVC CLI

A comprehensive command-line interface for managing W3C Verifiable Credentials, OpenAttestation documents, blockchain-based token registries, and transferable records. Built with modern cryptographic standards and multi-network blockchain support.

## Features

- ✅ **Modern Cryptosuites**: Full support for ECDSA-SD-2023 and BBS-2023
- ✅ **Key Pair Generation**: Generate cryptographic key pairs with Multikey format
- ✅ **DID Management**: Create and manage did:web identifiers
- ✅ **W3C Verifiable Credentials**: Sign, verify and manage W3C verifiable credentials
- ✅ **W3C Verifiable Presentations**: Present credentials as a holder and verify presentations
- ✅ **OpenAttestation**: Sign, verify, wrap/unwrap, and encrypt/decrypt OpenAttestation v2/v3 documents
- ✅ **Token Registry**: Mint tokens to blockchain-based token registries
- ✅ **Document Store**: Deploy and manage document store contracts
- ✅ **Title Escrow**: Complete transferable records management (holder/beneficiary transfers)
- ✅ **Obligation Registry (BoE)**: Deploy/mint obligation registries, manage ObligationEscrow lifecycle, and verify BoE documents via a dedicated pipeline
- ✅ **Gasless Transactions**: Sponsor gas for title-escrow, minting, and token registry deployment via EIP-7702 + Pimlico-sponsored `PlatformPaymaster` beta contracts (Sepolia, Amoy)
- ✅ **Credential Status**: Create and update W3C credential status lists
- ✅ **W3C Standards**: Compliant with latest W3C DID and Verifiable Credentials specifications
- ✅ **Multi-Network Support**: Ethereum, Polygon, XDC, Stability, and Astron networks
- ✅ **Interactive CLI**: User-friendly prompts for all operations

## Powered By

This CLI leverages the TrustVC package:

- `[@trustvc/trustvc](https://github.com/TrustVC/trustvc)` — Core library for W3C credentials, OpenAttestation, token registries, Obligation Registry (BoE), and blockchain operations

BoE on-chain helpers are imported from the **root** package (`mintObligationRegistry`, `acceptObligationRegistry`, …). Prefer those over any older `@trustvc/trustvc/obligation-registry` path.

Gasless transactions additionally use `viem` and `permissionless` for EIP-7702 smart-account tooling, and submit UserOperations through a [Pimlico](https://pimlico.io) bundler.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Commands](#commands)
  - [Available Commands](#available-commands)
  - [Detailed Command Reference](#detailed-command-reference)
- [Configuration](#configuration)
- [Development](#development)
  - [Setup](#setup)
  - [Project Structure](#project-structure)
- [License](#license)
- [Obligation Registry user guide](#obligation-registry-user-guide)
- [Gasless Transactions user guide](#gasless-transactions-user-guide)

## Prerequisites

- **Node.js 22.19.5+** — Download from [nodejs.org](https://nodejs.org) or use [nvm](https://github.com/nvm-sh/nvm):

```sh
nvm install 22.19.5
nvm use 22.19.5
```

## Installation

Install the CLI globally:

```sh
npm install -g @trustvc/trustvc-cli
```

Or run a single command without installing:

```sh
npx @trustvc/trustvc-cli <command>
```

## Quick Start

### W3C Verifiable Credentials

```sh
# Generate a key pair
trustvc key-pair-generation

# Create a DID from the key pair
trustvc did-web

# Sign a W3C verifiable credential
trustvc w3c-sign

# Present credential(s) you hold as a Verifiable Presentation
trustvc vp-sign

# Verify a W3C credential or presentation
trustvc verify

# Create a credential status list
trustvc credential-status-create

# Update a credential status list
trustvc credential-status-update
```

### OpenAttestation Documents

```sh
# Sign OpenAttestation documents
trustvc oa-sign

# Verify OpenAttestation documents
trustvc verify

# Wrap an OpenAttestation document
trustvc oa-wrap

# Unwrap an OpenAttestation document
trustvc oa-unwrap

# Encrypt an Open Attestation document for safe sharing
trustvc oa-encrypt

# Decrypt an encrypted Open Attestation document
trustvc oa-decrypt
```

### Wallet Management

```sh
# Create a new encrypted wallet
trustvc wallet create

# Encrypt an existing private key
trustvc wallet encrypt

# Decrypt and view wallet details
trustvc wallet decrypt
```

### Document Store

```sh
# Deploy a document store contract
trustvc document-store deploy

# Issue a document hash to the store
trustvc document-store issue

# Revoke a document hash from the store
trustvc document-store revoke

# Grant a role to an account
trustvc document-store grant-role

# Revoke a role from an account
trustvc document-store revoke-role

# Transfer ownership of the document store
trustvc document-store transfer-ownership
```

### Transaction

```sh
# Cancel a pending transaction (replace-by-fee) — interactive prompts
trustvc transaction cancel

# Or with options (non-interactive)
trustvc transaction cancel [options]
# e.g. trustvc transaction cancel --transaction-hash 0x... --network sepolia --encrypted-wallet-path ./wallet.json
```

### Token Registry & Title Escrow

```sh
# Mint a token to a registry
trustvc mint

# Deploy a token registry contract
trustvc token-registry deploy

# Transfer document holder
trustvc title-escrow transfer-holder

# Nominate new beneficiary
trustvc title-escrow nominate-transfer-owner

# Endorse beneficiary change
trustvc title-escrow endorse-transfer-owner

# Endorse full ownership transfer
trustvc title-escrow transfer-owner-holder

# Return document to issuer
trustvc title-escrow return-to-issuer

# Accept/reject returned documents
trustvc title-escrow accept-return-to-issuer
trustvc title-escrow reject-return-to-issuer

# Reject transfer requests
trustvc title-escrow reject-transfer-holder
trustvc title-escrow reject-transfer-owner
trustvc title-escrow reject-transfer-owner-holder
```

### Obligation Registry & Escrow (BoE)

```sh
# Deploy Obligation Registry (TrustVCToken + factory)
trustvc obligation-registry deploy

# Mint a BoE tokenId to obligationRegistry (sign first with w3c-sign)
trustvc w3c-sign
trustvc obligation-registry mint

# Lifecycle
trustvc obligation-escrow accept
trustvc obligation-escrow reject
trustvc obligation-escrow discharge
trustvc obligation-escrow status
trustvc obligation-escrow endorsement-chain

# Transfers (mirror title-escrow)
trustvc obligation-escrow transfer-holder
trustvc obligation-escrow nominate-transfer-owner
trustvc obligation-escrow endorse-transfer-owner
trustvc obligation-escrow transfer-owner-holder
trustvc obligation-escrow reject-transfer-holder
trustvc obligation-escrow reject-transfer-owner
trustvc obligation-escrow reject-transfer-owner-holder
trustvc obligation-escrow return-to-issuer
trustvc obligation-escrow accept-return-to-issuer
trustvc obligation-escrow reject-return-to-issuer

# Verify BoE or ETR documents (unified pipeline — auto-detects ObligationRecords)
trustvc verify
```

### Gasless (Sponsored) Transactions

> ⚠️ **Beta, testnets only.** Gasless transactions are in beta and only supported on Sepolia and Amoy — do not use them, or a `PlatformPaymaster`, in production.

```sh
# One-time setup: deploy a PlatformPaymaster (regular transaction — you pay gas)
trustvc deploy-platform-paymaster

# One-time setup: authorize what it may sponsor, then fund/stake it (owner-only, regular transactions)
trustvc paymaster-admin add-authorized-caller
trustvc paymaster-admin add-title-escrow
trustvc paymaster-admin add-registry
trustvc paymaster-admin fund-paymaster
trustvc paymaster-admin stake-paymaster

# Then add --gasless to any supported command — no ETH required from the caller
trustvc transfer-holder --gasless
trustvc endorse-transfer-owner --gasless
trustvc transfer-owner-holder --gasless
trustvc nominate-transfer-owner --gasless
trustvc reject-transfer-holder --gasless
trustvc reject-transfer-owner --gasless
trustvc reject-transfer-owner-holder --gasless
trustvc return-to-issuer --gasless
trustvc accept-return-to-issuer --gasless
trustvc reject-return-to-issuer --gasless
trustvc mint --gasless
trustvc token-registry deploy --gasless
```

See the [Gasless Transactions user guide](#gasless-transactions-user-guide) for required environment variables and the full setup workflow.

## How It Works

### W3C Credentials

- **Key Pair Generation**: Uses `generateKeyPair` from `@trustvc/trustvc` to create cryptographic key pairs supporting ECDSA-SD-2023 and BBS-2023 cryptosuites in Multikey format.
- **DID Creation**: Uses `issueDID` to generate did:web identifiers, allowing self-hosted DIDs as unique identifiers in decentralized systems.
- **Credential Signing**: Uses `signW3C` to sign verifiable credentials with did:web identifiers and modern cryptosuites.
- **Credential Verification**: Uses `verifyDocument` to verify W3C verifiable credentials.
- **Credential Status**: Provides commands to create and update W3C credential status lists for managing credential revocation and suspension.

- **Verifiable Presentations**: Uses `signW3CPresentation` to let a holder bundle and present their own credentials; presentations are verified by the same `verify` command as every other document. TrustVC enforces the presentation policies, so the CLI cannot disable them:
  - **Holder binding** — the signing key's DID must equal the presentation `holder` and every `credentialSubject.id`. The issuer is independent: a credential issued by another party is fine.
  - **Mandatory expiry** — every presentation carries a `validUntil`; `vp-sign` always asks for one.
  - **Full disclosure** — a selective-disclosure credential that has not been derived is auto-derived.
  - **v2 envelope** — the presentation envelope is always VC Data Model 2.0; embedded credentials keep their own version.
  - Credentials with a `TransferableRecords` status cannot be presented — ownership of a transferable record lives on-chain.

  The holder proof is an `assertionMethod` proof: the CLI does not issue challenges, since an anti-replay nonce can only be checked by the verifier that issued it.

### OpenAttestation

- **Document Signing**: Uses `signOA` to cryptographically sign OpenAttestation v2 and v3 documents with private keys.
- **Document Verification**: Uses `verifyDocument` to verify OpenAttestation documents.
- **Document Wrapping**: Uses `wrapOA` to wrap OpenAttestation documents.
- **Document Unwrapping**: Uses `unwrapOA` to unwrap OpenAttestation documents.
- **Document Encryption**: Uses `oa-encrypt` to encrypt OA documents for safe sharing; use `oa-decrypt` with the same key to recover the document.

### Blockchain Operations

- **Token Registry**: Deploy token registry contracts and mint document hashes (tokenIds) to blockchain-based token registries across multiple networks (Ethereum, Polygon, XDC, Stability, Astron).
- **Document Store**: Deploy document store contracts and use `documentStoreIssue` and `documentStoreRevoke` to issue and revoke document hashes in deployed contracts.
- **Transaction Cancel**: Cancel a pending transaction by replacing it with a 0-value transaction to yourself (same nonce, higher gas price). Supports specifying by transaction hash or by nonce and gas price.
- **Title Escrow**: Provides comprehensive transferable records management including holder transfers, beneficiary nominations, endorsements, returns, and rejections using smart contracts.
- **Obligation Registry (BoE)**: Separate command trees for electronic Bill of Exchange on-chain flows — `obligation-registry` (deploy/mint) and `obligation-escrow` (accept/reject/discharge, transfers, return). Use `trustvc verify` for both ETR and BoE documents (ObligationRecords vs TransferableRecords is auto-detected). Do not use classic `token-registry` / `title-escrow` for obligation documents. See [Obligation Registry user guide](#obligation-registry-user-guide).
- **Gasless Transactions** (⚠️ beta, testnets only): Pass `--gasless` to a supported title-escrow, `mint`, or `token-registry deploy` command to submit it as an EIP-7702 smart-account UserOperation sponsored by a `PlatformPaymaster`, instead of a regular transaction paid from your own wallet balance. Gas is drawn from the PlatformPaymaster's EntryPoint deposit; Pimlico bundles and (optionally) sponsors the UserOperation. Only available on Sepolia and Amoy — not for production use. See [Gasless Transactions user guide](#gasless-transactions-user-guide).

## Commands

### Available Commands


| Category             | Command                                                                                   | Description                                                |
| -------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **W3C Credentials**  | `[key-pair-generation](#key-pair-generation)`                                             | Generate cryptographic key pairs (ECDSA-SD-2023, BBS-2023) |
|                      | `[did-web](#did-web)`                                                                     | Create did:web identifiers from key pairs                  |
|                      | `[w3c-sign](#w3c-sign)`                                                                   | Sign W3C verifiable credentials                            |
|                      | `[verify](#verify)`                                                                       | Verify W3C verifiable credentials                          |
|                      | `[credential-status-create](#credential-status-create)`                                   | Create credential status lists                             |
|                      | `[credential-status-update](#credential-status-update)`                                   | Update credential status (revoke/suspend)                  |
| **OpenAttestation**  | `[oa-sign](#oa-sign)`                                                                     | Sign OpenAttestation v2/v3 documents                       |
|                      | `[verify](#verify)`                                                                       | Verify OpenAttestation documents                           |
|                      | `[oa-wrap](#oa-wrap)`                                                                     | Wrap OpenAttestation documents                             |
|                      | `[oa-unwrap](#oa-unwrap)`                                                                 | Unwrap OpenAttestation documents                           |
|                      | `[oa-encrypt](#oa-encrypt)`                                                               | Encrypt an OA document for safe sharing and storage        |
|                      | `[oa-decrypt](#oa-decrypt)`                                                               | Decrypt an OA document encrypted with oa-encrypt           |
| **Token Registry**   | `[mint](#mint)`                                                                           | Mint tokens to blockchain registries                       |
|                      | `[token-registry deploy](#token-registry-deploy)`                                         | Deploy token registry contracts                            |
|                      | `token-registry mint`                                                                     | Alternative: `mint`                                        |
| **Document Store**   | `[document-store deploy](#document-store-deploy)`                                         | Deploy document store contracts                            |
|                      | `[document-store issue](#document-store-issue)`                                           | Issue document hashes                                      |
|                      | `[document-store revoke](#document-store-revoke)`                                         | Revoke document hashes                                     |
|                      | `[document-store grant-role](#document-store-grant-role)`                                 | Grant roles to accounts                                    |
|                      | `[document-store revoke-role](#document-store-revoke-role)`                               | Revoke roles from accounts                                 |
|                      | `[document-store transfer-ownership](#document-store-transfer-ownership)`                 | Transfer document store ownership                          |
| **Transaction**      | `[transaction cancel](#transaction-cancel)`                                               | Cancel a pending transaction                               |
| **Wallet**           | `[wallet create](#wallet-create)`                                                         | Create a new encrypted wallet file                         |
|                      | `[wallet encrypt](#wallet-encrypt)`                                                       | Encrypt a wallet using a private key                       |
|                      | `[wallet decrypt](#wallet-decrypt)`                                                       | Decrypt an encrypted wallet file                           |
| **Title Escrow**     | `[transfer-holder](#title-escrow-transfer-holder)`                                        | Transfer document holder                                   |
|                      | `title-escrow transfer-holder`                                                            | Alternative: `transfer-holder`                             |
|                      | `[nominate-transfer-owner](#title-escrow-nominate-transfer-owner)`                        | Nominate new beneficiary                                   |
|                      | `title-escrow nominate-transfer-owner`                                                    | Alternative: `nominate-transfer-owner`                     |
|                      | `[endorse-transfer-owner](#title-escrow-endorse-transfer-owner)`                          | Endorse beneficiary change                                 |
|                      | `title-escrow endorse-transfer-owner`                                                     | Alternative: `endorse-transfer-owner`                      |
|                      | `[transfer-owner-holder](#title-escrow-transfer-owner-holder)`                            | Endorse full ownership transfer                            |
|                      | `title-escrow transfer-owner-holder`                                                      | Alternative: `transfer-owner-holder`                       |
|                      | `[return-to-issuer](#title-escrow-return-to-issuer)`                                      | Return document to issuer                                  |
|                      | `title-escrow return-to-issuer`                                                           | Alternative: `return-to-issuer`                            |
|                      | `[accept-return-to-issuer](#title-escrow-accept-return-to-issuer)`                        | Accept returned document                                   |
|                      | `title-escrow accept-return-to-issuer`                                                    | Alternative: `accept-return-to-issuer`                     |
|                      | `[reject-return-to-issuer](#title-escrow-reject-return-to-issuer)`                        | Reject returned document                                   |
|                      | `title-escrow reject-return-to-issuer`                                                    | Alternative: `reject-return-to-issuer`                     |
|                      | `[reject-transfer-holder](#title-escrow-reject-transfer-holder)`                          | Reject holder transfer                                     |
|                      | `title-escrow reject-transfer-holder`                                                     | Alternative: `reject-transfer-holder`                      |
|                      | `[reject-transfer-owner](#title-escrow-reject-transfer-owner)`                            | Reject owner transfer                                      |
|                      | `[reject-transfer-owner-holder](#title-escrow-reject-transfer-owner-holder)`              | Reject full transfer                                       |
|                      | `title-escrow reject-transfer-owner-holder`                                               | Alternative: `reject-transfer-owner-holder`                |
| **Obligation / BoE** | `[obligation-registry deploy](#obligation-registry-deploy)`                               | Deploy Obligation Registry                                 |
|                      | `[obligation-registry mint](#obligation-registry-mint)`                                   | Mint BoE token to obligationRegistry                       |
|                      | `[obligation-escrow accept](#obligation-escrow-accept)`                                   | Accept obligation                                          |
|                      | `[obligation-escrow reject](#obligation-escrow-reject)`                                   | Reject obligation                                          |
|                      | `[obligation-escrow discharge](#obligation-escrow-discharge)`                             | Discharge obligation                                       |
|                      | `[obligation-escrow status](#obligation-escrow-status)`                                   | Read obligation / escrow status                            |
|                      | `[obligation-escrow endorsement-chain](#obligation-escrow-endorsement-chain)`             | Fetch endorsement chain (transfers + status events)        |
|                      | `[obligation-escrow transfer-holder](#obligation-escrow-transfer-holder)`                 | Transfer BoE holder                                        |
|                      | `[obligation-escrow nominate-transfer-owner](#obligation-escrow-nominate-transfer-owner)` | Nominate BoE beneficiary                                   |
|                      | `[obligation-escrow endorse-transfer-owner](#obligation-escrow-endorse-transfer-owner)`   | Endorse BoE beneficiary change                             |
|                      | `[obligation-escrow transfer-owner-holder](#obligation-escrow-transfer-owner-holder)`     | Endorse full BoE ownership transfer                        |
|                      | `[obligation-escrow return-to-issuer](#obligation-escrow-return-to-issuer)`               | Return BoE to issuer                                       |
|                      | `[obligation-escrow accept-return-to-issuer](#obligation-escrow-accept-return-to-issuer)` | Accept returned BoE                                        |
|                      | `[obligation-escrow reject-return-to-issuer](#obligation-escrow-reject-return-to-issuer)` | Reject returned BoE                                        |
|                      | `[obligation-escrow reject-transfer-*](#obligation-escrow-transfer-holder)`               | Reject BoE transfer requests                               |




---

### Wallet/Private Key Options

Commands that submit transactions (title-escrow, obligation-registry, obligation-escrow write actions, token registry, document-store, and transaction) require a wallet or private key to sign. Read-only `obligation-escrow status` and `obligation-escrow endorsement-chain` do not — they use the network RPC/provider from the document (override with `{NETWORK}_RPC` if needed). You can provide your private key in one of the following ways:

**Select wallet/private key option:**

- **Encrypted wallet file (recommended)** - Use an encrypted JSON wallet file for secure key storage
- **Environment variable (OA_PRIVATE_KEY)** - Set your private key in the `OA_PRIVATE_KEY` environment variable
- **Private key file** - Provide a file containing your private key
- **Private key directly** - Enter your private key directly (not recommended for production)

---

### Detailed Command Reference

#### transaction cancel

Cancels a pending transaction by replacing it with a 0-value transaction to yourself using the same nonce and a higher gas price (replace-by-fee). This action is irreversible.

**Interactive Usage (recommended):**

```sh
trustvc transaction cancel
```

You will be prompted for:

1. **How to specify the pending transaction**

- **By transaction hash (recommended)** – Enter the pending transaction hash (0x...). Nonce and gas price are fetched from the network and the gas price is increased by 100% for the replacement.
- **By nonce and gas price** – Enter the pending transaction nonce and a higher gas price (wei) for the replacement. Use this when the pending transaction uses EIP-1559 (no legacy `gasPrice`) or when you prefer to set the replacement gas manually.

2. **Network** – Select the network (e.g. Sepolia, Mainnet).
3. **Wallet / private key** – Choose encrypted wallet file, environment variable (OA_PRIVATE_KEY), key file, or enter the private key.

**With options (non-interactive):**

```sh
# Cancel by nonce and gas price
trustvc transaction cancel \
  --nonce 205 \
  --gas-price 25000000000 \
  --network sepolia \
  --encrypted-wallet-path ./wallet.json

# Cancel by transaction hash
trustvc transaction cancel \
  --transaction-hash 0x... \
  --network sepolia \
  --encrypted-wallet-path ./wallet.json
```

**Options:** `--transaction-hash` (or `-th`), `--nonce`, `--gas-price`, `--network`, `--encrypted-wallet-path`, `--key`, `--key-file`, `--rpc-url`. Wallet can also be provided via `OA_PRIVATE_KEY`.

- `--nonce` and `--gas-price` must be provided together and must not be combined with `--transaction-hash`.
- `--transaction-hash` can be used alone; gas price is fetched and increased by 100% automatically.

**Output:**

- The replacement transaction hash.
- A link to view the replacement transaction on the network’s block explorer (e.g. Etherscan).

**Note:** If the pending transaction uses EIP-1559 (maxFeePerGas / maxPriorityFeePerGas), it has no legacy `gasPrice`. In that case, specify the transaction by **nonce and gas price** and set a gas price (in wei) for the replacement.

#### key-pair-generation

Generates cryptographic key pairs for modern cryptosuites (ECDSA-SD-2023, BBS-2023).

**Usage:**

```sh
trustvc key-pair-generation
```

**Interactive Prompts:**

- Select encryption algorithm (ECDSA-SD-2023 or BBS-2023)
- Enter seed (optional, BBS-2023 only)
- Specify output directory

**Output:**
Creates `keypair.json` containing:

- `type`: Multikey
- `publicKeyMultibase`: Public key in multibase format
- `secretKeyMultibase`: Secret key in multibase format
- `seedBase58`: Seed (if provided for BBS-2023)

#### did-web

Generates a did:web identifier from an existing key pair.

**Usage:**

```sh
trustvc did-web
```

**Interactive Prompts:**

- Path to key pair JSON file
- Select cryptosuite (must match the key pair)
- Domain name for did:web hosting
- Output directory

**Output:**

- `wellknown.json`: DID document for hosting at `/.well-known/did.json`
- `didKeyPairs.json`: Key pair information with DID references

#### w3c-sign

Signs a W3C verifiable credential using a did:web identifier.

**Usage:**

```sh
trustvc w3c-sign
```

**Interactive Prompts:**

- Path to did:web key-pair JSON file
- Path to unsigned verifiable credential JSON file
- Select cryptosuite (ECDSA-SD-2023 or BBS-2023)
- Output directory

**Output:**
Creates `signed_vc.json` with cryptographic proof.

#### verify

Verifies a W3C or OA document using the unified TrustVC verification pipeline.

Works for **classic ETR** (`tokenRegistry` → TransferableRecords fragment) and **BoE** (`obligationRegistry` → ObligationRecords fragment). Both report the same keys: `DOCUMENT_INTEGRITY`, `DOCUMENT_STATUS`, and `ISSUER_IDENTITY` with `VALID` / `SKIPPED` / `INVALID` / `ERROR`. For BoE, `DOCUMENT_STATUS` is the ObligationRecords fragment (minted on the obligation registry), not a registry address dump.

**Usage:**

```sh
trustvc verify
```

**Interactive Prompts:**

- Path to document JSON file
- [If network required but no network detected]: Select network

**Output:**
Verifies document integrity, status, and issuer identity (`DOCUMENT_INTEGRITY`, `DOCUMENT_STATUS`, `ISSUER_IDENTITY`).

**Supported Formats:**

- W3C Verifiable Credential (ETR, BoE, revocable VDs)
- W3C Verifiable Presentation
- OpenAttestation v2
- OpenAttestation v3

**Verifiable Presentations:**
For a presentation, the three results cover the presentation as a whole — `DOCUMENT_INTEGRITY` is the holder proof plus holder binding (an unsigned presentation is invalid), `DOCUMENT_STATUS` is the presentation expiry plus each embedded credential's revocation, and `ISSUER_IDENTITY` resolves each embedded issuer. Freshness of an `authentication` proof (challenge/domain) is not checked — only the verifier that issued the challenge can do that.

A valid presentation adds one line stating how many credentials it covered, since the three results read identically over one credential or five:

```text
✔  success   DOCUMENT_INTEGRITY: VALID
✔  success   DOCUMENT_STATUS: VALID
✔  success   ISSUER_IDENTITY: VALID
ℹ  info      2 embedded credentials verified.
```

#### vp-sign

Creates **and** signs a W3C Verifiable Presentation from one or more signed credentials, so a holder can present credentials they own.

**Usage:**

```sh
trustvc vp-sign
```

**Interactive Prompts:**

- A directory of signed verifiable credentials, **or** the path(s) to individual JSON files (comma-separated). Given a directory, **every file in it is presented** — nothing is filtered by extension or content, so anything that is not a presentable credential is reported by the signing step, naming the file it came from. Sub-directories and dot-files (`.DS_Store` and the like) are skipped.
- Path to the holder did key-pair JSON file (defaults to `./didKeyPairs.json`). The holder DID is taken from this file and is **not** asked for — trustvc requires the signing key's DID to _be_ the holder, so there is nothing to choose. A key pair with no DID (the bare `keypair.json` from [`key-pair-generation`](#key-pair-generation)) is rejected up front; use the `didKeyPairs.json` that [`did-web`](#did-web) writes.
- Presentation expiry — either a lifetime in seconds or an explicit `validUntil` timestamp
- Output directory

**Output:**
Creates `signed_vp.json`, holding an `assertionMethod` holder proof. Verify it with [`verify`](#verify).

**Requirements:**

- The holder key pair must be an ECDSA (P-256) Multikey bound to a DID — the `didKeyPairs.json` produced by [`did-web`](#did-web) is one.
- Every credential must be about the holder: each `credentialSubject.id` must equal the holder DID. Credentials with a `TransferableRecords` status cannot be presented.

#### credential-status-create

Creates a new W3C credential status list for managing revocation.

**Usage:**

```sh
trustvc credential-status-create
```

**Interactive Prompts:**

- Path to key pair JSON file
- Select cryptosuite (ECDSA-SD-2023 or BBS-2023)
- Hosting URL for the credential status list
- Output directory
- Status list length (optional)

**Output:**
Signed credential status list file.

#### credential-status-update

Updates an existing W3C credential status list to revoke or suspend credentials.

**Usage:**

```sh
trustvc credential-status-update
```

**Interactive Prompts:**

- Path to existing credential status file
- Path to key pair JSON file
- Output directory
- Credential index to update

**Output:**
Updated credential status list file.

#### oa-sign

Signs OpenAttestation v2 or v3 documents with a private key.

**Usage:**

```sh
trustvc oa-sign
```

**Interactive Prompts:**

- Path to raw OA document or directory
- Output directory for signed documents
- Public key (e.g., did:ethr:0x...#controller)
- Private key source:
  - Environment variable (OA_PRIVATE_KEY)
  - Private key file
  - Direct private key input

**Output:**
Signed OpenAttestation documents in the specified directory.

**Supported Formats:**

- OpenAttestation v2
- OpenAttestation v3

#### oa-wrap

Wraps OpenAttestation v2 or v3 documents

**Usage:**

```sh
trustvc oa-wrap
```

**Interactive Prompts:**

- Select wrapping in Individual or Batch mode
- Path to raw OA document or directory (multiple documents)
- Output directory for wrapped documents

**Output:**
Wrapped OpenAttestation document(s) in the specified directory.

**Supported Formats:**

- OpenAttestation v2
- OpenAttestation v3

#### oa-unwrap

Unwraps OpenAttestation v2 or v3 documents

**Usage:**

```sh
trustvc oa-unwrap
```

**Interactive Prompts:**

- Path to wrapped OA document or directory
- Output directory for unwrapped documents

**Output:**
Unwrapped OpenAttestation document(s) in the specified directory.

**Supported Formats:**

- OpenAttestation v2
- OpenAttestation v3

#### oa-encrypt

Encrypts an Open Attestation document for safe sharing and storage. You will be prompted for an encryption key — remember it to decrypt later.

**Usage:**

```sh
trustvc oa-encrypt
```

**Interactive Prompts:**

- Path to your Open Attestation document (raw or wrapped OA v2/v3)
- Path for the output encrypted file
- Encryption key (entered securely; not echoed)

**Output:**

Writes an encrypted document file containing `type: "encrypted-document"` and a `ciphertext` field. Only someone with the same key can decrypt it with `oa-decrypt`.

**Supported Input:**

- OpenAttestation v2 (raw or wrapped)
- OpenAttestation v3 (raw or wrapped)

#### oa-decrypt

Decrypts an Open Attestation document that was encrypted using `oa-encrypt`. You will be prompted for the decryption key.

**Usage:**

```sh
trustvc oa-decrypt
```

**Interactive Prompts:**

- Path to the encrypted document file
- Path for the output decrypted document
- Decryption key (entered securely; not echoed)

**Output:**

Writes the decrypted Open Attestation document (raw OA v2/v3 or wrapped OA v2/v3) to the specified path. Fails if the key is wrong or the file is not a valid encrypted OA document.

#### mint

Mints a document hash (tokenId) to a token registry smart contract.

**Usage:**

```sh
trustvc mint
```

**Interactive Prompts:**

- Path to TT/JSON document file (or manual input)
  - _Network, token registry address, token ID, and document ID are extracted from the document_
- Beneficiary address (initial recipient)
- Holder address (initial holder)
- Wallet/private key option
- Remark (optional, V5 registries only - will be encrypted with document ID as encryption key)

**Output:**
Transaction receipt with hash, block number, gas used, and explorer link.

**Supported Networks:**

- Ethereum (Mainnet, Sepolia)
- Polygon (Mainnet, Amoy Testnet)
- XDC Network (Mainnet, Apothem Testnet)
- Stability (Mainnet, Testnet)
- Astron (Mainnet, Testnet)

#### token-registry deploy

Deploys a token registry contract on the blockchain.

**Usage:**

```sh
trustvc token-registry deploy
```

**Interactive Prompts:**

- Network selection (Ethereum, Polygon, XDC, Stability, Astron)
- Token registry name
- Token registry symbol
- Wallet/private key option
- Dry-run option (estimate gas before deployment)

**Output:**
Transaction receipt with deployed contract address, hash, block number, gas used, and explorer link.

**Supported Networks:**

- Ethereum (Mainnet, Sepolia)
- Polygon (Mainnet, Amoy Testnet)
- XDC Network (Mainnet, Apothem Testnet)
- Stability (Mainnet, Testnet)
- Astron (Mainnet, Testnet)

#### token-registry mint

Alternative command for minting tokens. Functionally identical to `mint`.

**Usage:**

```sh
# Short form
trustvc mint

# Or with prefix
trustvc token-registry mint
```

#### document-store deploy

Deploys a document store contract on the blockchain.

**Usage:**

```sh
trustvc document-store deploy
```

**Interactive Prompts:**

- Enter the name of the document store
- Select network
- Enter owner address (optional, defaults to deployer address)
- Wallet/private key option

**Output:**
Transaction receipt with contract address, hash, block number, gas used, and explorer link.

**Supported Networks:**

- Ethereum (Mainnet, Sepolia)
- Polygon (Mainnet, Amoy Testnet)
- XDC Network (Mainnet, Apothem Testnet)
- Stability (Mainnet, Testnet)
- Astron (Mainnet, Testnet)

#### document-store issue

Issues a document hash to a deployed document store.

**Usage:**

```sh
trustvc document-store issue
```

**Interactive Prompts:**

- Path to TT/JSON document file (extracts store address, token ID, network)
- Wallet/private key option

**Output:**
Transaction receipt confirming the hash issuance.

#### document-store revoke

Revokes a document hash from a deployed document store.

**Usage:**

```sh
trustvc document-store revoke
```

**Interactive Prompts:**

- Path to TT/JSON document file (extracts store address, token ID, network)
- Wallet/private key option

**Output:**
Transaction receipt confirming the hash revocation.

#### document-store grant-role

Grants a role (ISSUER_ROLE, REVOKER_ROLE, or DEFAULT_ADMIN_ROLE) to an account in a deployed document store.

**Usage:**

```sh
trustvc document-store grant-role
```

**Interactive Prompts:**

- Path to document file (or manual input for document store address)
- Role to grant (ISSUER_ROLE, REVOKER_ROLE, DEFAULT_ADMIN_ROLE)
- Account address to grant the role to
- Wallet/private key option
- Dry-run option (estimate gas before execution)

**Output:**
Transaction receipt with hash, block number, gas used, and explorer link.

**Supported Networks:**

- Ethereum (Mainnet, Sepolia)
- Polygon (Mainnet, Amoy Testnet)
- XDC Network (Mainnet, Apothem Testnet)
- Stability (Mainnet, Testnet)
- Astron (Mainnet, Testnet)

#### document-store revoke-role

Revokes a role (ISSUER_ROLE, REVOKER_ROLE, or DEFAULT_ADMIN_ROLE) from an account in a deployed document store.

**Usage:**

```sh
trustvc document-store revoke-role
```

**Interactive Prompts:**

- Path to document file (or manual input for document store address)
- Role to revoke (ISSUER_ROLE, REVOKER_ROLE, DEFAULT_ADMIN_ROLE)
- Account address to revoke the role from
- Wallet/private key option
- Dry-run option (estimate gas before execution)

**Output:**
Transaction receipt with hash, block number, gas used, and explorer link.

**Supported Networks:**

- Ethereum (Mainnet, Sepolia)
- Polygon (Mainnet, Amoy Testnet)
- XDC Network (Mainnet, Apothem Testnet)
- Stability (Mainnet, Testnet)
- Astron (Mainnet, Testnet)

#### document-store transfer-ownership

Transfers ownership of a document store contract to a new owner. This grants DEFAULT_ADMIN_ROLE to the new owner and revokes it from the current owner.

**Usage:**

```sh
trustvc document-store transfer-ownership
```

**Interactive Prompts:**

- Path to document file (or manual input for document store address)
- New owner address
- Wallet/private key option

**Output:**
Transaction receipts for both grant and revoke operations with hashes, block numbers, gas used, and explorer links.

**Supported Networks:**

- Ethereum (Mainnet, Sepolia)
- Polygon (Mainnet, Amoy Testnet)
- XDC Network (Mainnet, Apothem Testnet)
- Stability (Mainnet, Testnet)
- Astron (Mainnet, Testnet)

#### wallet create

Creates a new encrypted wallet file with a randomly generated private key.

**Usage:**

```sh
trustvc wallet create
```

**Interactive Prompts:**

- Enter wallet password (with confirmation)
- Specify output directory for the encrypted wallet file

**Output:**

Creates `wallet.json` containing the encrypted wallet in the specified directory.

**Important Information Displayed:**

- Wallet address
- Mnemonic phrase (12-word recovery phrase)
- Security warnings about password and mnemonic storage

**Security Notes:**

- Store your password securely - it cannot be recovered if lost
- Save your mnemonic phrase in a safe place - it can be used to recover your wallet
- Never share your encrypted wallet file or mnemonic phrase publicly

**Example Output:**

```
✔ Wallet created and encrypted successfully
ℹ Saved to: ./wallet.json

ℹ Wallet Address: 0x1234567890abcdef1234567890abcdef12345678
ℹ Mnemonic Phrase: word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12

⚠ IMPORTANT: Store your password and mnemonic phrase securely!
⚠ IMPORTANT: Never share this file or your mnemonic phrase publicly!
⚠ IMPORTANT: If you lose your password, you will not be able to recover your wallet!
```

#### wallet encrypt

Encrypts an existing private key into a secure wallet file.

**Usage:**

```sh
trustvc wallet encrypt
```

**Interactive Prompts:**

- Enter your private key (with or without 0x prefix)
- Enter wallet password (with confirmation)
- Specify output directory for the encrypted wallet file

**Output:**

Creates `wallet.json` containing the encrypted wallet in the specified directory.

**Important Information Displayed:**

- Wallet address derived from the private key
- Security warnings about password storage

**Security Notes:**

- Your private key is encrypted using the password you provide
- The original private key is not stored - only the encrypted version
- Store your password securely - it cannot be recovered if lost
- Never share your encrypted wallet file or private key publicly

**Use Cases:**

- Secure storage of an existing private key
- Converting a plain private key to an encrypted format
- Creating a portable encrypted wallet for use with the CLI

**Example Output:**

```
✔ Wallet encrypted and saved successfully
ℹ Saved to: ./wallet.json

ℹ Wallet Address: 0x1234567890abcdef1234567890abcdef12345678

⚠ IMPORTANT: Store your password securely!
⚠ IMPORTANT: Never share this file or your private key publicly!
⚠ IMPORTANT: If you lose your password, you will not be able to recover your wallet!
```

#### wallet decrypt

Decrypts an encrypted wallet file and displays the private key and mnemonic phrase.

**Usage:**

```sh
trustvc wallet decrypt
```

**Interactive Prompts:**

- Path to encrypted wallet JSON file
- Enter wallet password
- Security confirmation (you must acknowledge the risks)

**Output:**

Displays the decrypted wallet information:

- Wallet address
- Private key
- Mnemonic phrase (if available)

**Security Warnings:**

⚠️ **CRITICAL SECURITY NOTICE:**

- This command reveals your private key in plain text
- Anyone with your private key has full control of your wallet
- Never share your private key or mnemonic phrase with anyone
- Clear your terminal history after using this command
- Only use this command in a secure, private environment

**Use Cases:**

- Recovering your private key from an encrypted wallet
- Exporting your wallet to another application
- Verifying wallet contents before use

**Example Output:**

```
⚠️ You are about to reveal the private key of your wallet.
? Do you understand the risks and want to proceed? Yes

ℹ Wallet Address: 0x1234567890abcdef1234567890abcdef12345678
ℹ Private Key: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
ℹ Mnemonic Phrase: word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12

⚠ IMPORTANT: Never share your private key or mnemonic phrase with anyone!
⚠ IMPORTANT: Store this information securely and delete it from your terminal history!
```

#### title-escrow transfer-holder

Transfers the holder of a transferable record to a new address.

**Who Can Execute:**
Only the **current holder** of the transferable record.

**Usage:**

```sh
# Short form
trustvc transfer-holder

# Or with prefix
trustvc title-escrow transfer-holder
```

**Interactive Prompts:**

- Path to TT/JSON document file (or manual input)
  - _Network, token registry address, token ID, and document ID are extracted from the document_
- New holder address
- Wallet/private key option
- Remark (optional, V5 registries only - will be encrypted with document ID as encryption key)

**Output:**
Transaction receipt confirming holder transfer.

#### title-escrow nominate-transfer-owner

Nominates a new beneficiary (owner) for the transferable record.

**Who Can Execute:**
Only the **current holder** of the transferable record.

**Usage:**

```sh
# Short form
trustvc nominate-transfer-owner

# Or with prefix
trustvc title-escrow nominate-transfer-owner
```

**Interactive Prompts:**

- Path to TT/JSON document file (or manual input)
  - _Network, token registry address, token ID, and document ID are extracted from the document_
- New beneficiary address
- Wallet/private key option
- Remark (optional, V5 registries only - will be encrypted with document ID as encryption key)

**Output:**
Transaction receipt confirming beneficiary nomination.

#### title-escrow endorse-transfer-owner

Endorses the change of beneficiary (owner) for the transferable record.

**Who Can Execute:**
Only the **current beneficiary (owner)** of the transferable record.

**Usage:**

```sh
# Short form
trustvc endorse-transfer-owner

# Or with prefix
trustvc title-escrow endorse-transfer-owner
```

**Interactive Prompts:**

- Path to TT/JSON document file (or manual input)
  - _Network, token registry address, token ID, and document ID are extracted from the document_
- New beneficiary address
- Wallet/private key option
- Remark (optional, V5 registries only - will be encrypted with document ID as encryption key)

**Output:**
Transaction receipt confirming beneficiary endorsement.

#### title-escrow transfer-owner-holder

Endorses the transfer of both beneficiary and holder to new addresses.

**Who Can Execute:**
Only the **current beneficiary (owner)** of the transferable record.

**Usage:**

```sh
# Short form
trustvc transfer-owner-holder

# Or with prefix
trustvc title-escrow transfer-owner-holder
```

**Interactive Prompts:**

- Path to TT/JSON document file (or manual input)
  - _Network, token registry address, token ID, and document ID are extracted from the document_
- New beneficiary address
- New holder address
- Wallet/private key option
- Remark (optional, V5 registries only - will be encrypted with document ID as encryption key)

**Output:**
Transaction receipt confirming full ownership transfer.

#### title-escrow return-to-issuer

Returns the transferable record to the issuer.

**Who Can Execute:**
Both the **current holder** and **current beneficiary (owner)** must execute this together, or the entity that holds both roles.

**Usage:**

```sh
# Short form
trustvc return-to-issuer

# Or with prefix
trustvc title-escrow return-to-issuer
```

**Interactive Prompts:**

- Path to TT/JSON document file (or manual input)
  - _Network, token registry address, token ID, and document ID are extracted from the document_
- Wallet/private key option
- Remark (optional, V5 registries only - will be encrypted with document ID as encryption key)

**Output:**
Transaction receipt confirming document return.

#### title-escrow accept-return-to-issuer

Accepts a returned transferable record (issuer action).

**Who Can Execute:**
Only the **issuer** of the transferable record.

**Usage:**

```sh
# Short form
trustvc accept-return-to-issuer

# Or with prefix
trustvc title-escrow accept-return-to-issuer
```

**Interactive Prompts:**

- Path to TT/JSON document file (or manual input)
  - _Network, token registry address, token ID, and document ID are extracted from the document_
- Wallet/private key option
- Remark (optional, V5 registries only - will be encrypted with document ID as encryption key)

**Output:**
Transaction receipt confirming acceptance.

#### title-escrow reject-return-to-issuer

Rejects a returned transferable record (issuer action).

**Who Can Execute:**
Only the **issuer** of the transferable record.

**Usage:**

```sh
# Short form
trustvc reject-return-to-issuer

# Or with prefix
trustvc title-escrow reject-return-to-issuer
```

**Interactive Prompts:**

- Path to TT/JSON document file (or manual input)
  - _Network, token registry address, token ID, and document ID are extracted from the document_
- Wallet/private key option
- Remark (optional, V5 registries only - will be encrypted with document ID as encryption key)

**Output:**
Transaction receipt confirming rejection.

#### title-escrow reject-transfer-holder

Rejects a holder transfer request.

**Who Can Execute:**
Only the **current holder** of the transferable record.

**Usage:**

```sh
# Short form
trustvc reject-transfer-holder

# Or with prefix
trustvc title-escrow reject-transfer-holder
```

**Interactive Prompts:**

- Path to TT/JSON document file (or manual input)
  - _Network, token registry address, token ID, and document ID are extracted from the document_
- Wallet/private key option
- Remark (optional, V5 registries only - will be encrypted with document ID as encryption key)

**Output:**
Transaction receipt confirming rejection.

#### title-escrow reject-transfer-owner

Rejects a beneficiary transfer request.

**Who Can Execute:**
Only the **current beneficiary (owner)** of the transferable record.

**Usage:**

```sh
# Short form
trustvc reject-transfer-owner

# Or with prefix
trustvc title-escrow reject-transfer-owner
```

**Interactive Prompts:**

- Path to TT/JSON document file (or manual input)
  - _Network, token registry address, token ID, and document ID are extracted from the document_
- Wallet/private key option
- Remark (optional, V5 registries only - will be encrypted with document ID as encryption key)

**Output:**
Transaction receipt confirming rejection.

#### title-escrow reject-transfer-owner-holder

Rejects a full ownership transfer (both beneficiary and holder).

**Who Can Execute:**
Only the **current holder and beneficiary (owner)** of the transferable record (must be the same address).

**Usage:**

```sh
# Short form
trustvc reject-transfer-owner-holder

# Or with prefix
trustvc title-escrow reject-transfer-owner-holder
```

**Interactive Prompts:**

- Path to TT/JSON document file (or manual input)
  - _Network, token registry address, token ID, and document ID are extracted from the document_
- Wallet/private key option
- Remark (optional, V5 registries only - will be encrypted with document ID as encryption key)

**Output:**
Transaction receipt confirming rejection.

#### obligation-registry deploy

Deploys an Obligation Registry (`TrustVCToken` + `ObligationEscrowFactory`) for electronic Bill of Exchange (BoE) flows.

**Do not use** `token-registry deploy` for BoE documents.

**Usage:**

```sh
trustvc obligation-registry deploy
```

**Interactive Prompts:**

- Network selection
- Registry name and symbol
- Optionally reuse an existing ObligationEscrowFactory address
- Wallet/private key option
- Dry-run confirmation before broadcasting

**Output:**
Deployed `ObligationEscrowFactory` and Obligation Registry addresses plus transaction receipt. Copy the Obligation Registry address into `credentialStatus.obligationRegistry` in your BoE document before signing and minting.

#### obligation-registry mint

Mints a BoE tokenId to an Obligation Registry and creates the linked ObligationEscrow.

**Do not use** classic `mint` / `token-registry mint` for BoE documents.

**Before minting:** set `credentialStatus.obligationRegistry` to your deployed registry address, then sign the document with `[w3c-sign](#w3c-sign)`. Mint only accepts a signed Verifiable Credential.

**Usage:**

```sh
trustvc w3c-sign
trustvc obligation-registry mint
```

**Interactive Prompts:**

- Path to signed BoE / obligation document (output of `w3c-sign`)
  - _Network, obligationRegistry address, token ID, and document ID are extracted from the document_
- Holder and beneficiary (drawer/drawee) addresses as required
- Wallet/private key option
- Dry-run confirmation before broadcasting

**Output:**
Transaction receipt confirming mint.

#### obligation-escrow accept

Accepts an obligation on the ObligationEscrow (drawee acceptance).

**Usage:**

```sh
trustvc obligation-escrow accept
```

**Interactive Prompts:**

- Path to BoE / obligation document
  - _Network, obligationRegistry, token ID, and document ID are extracted from the document_
- Wallet/private key option
- Remark (optional)

**Output:**
Transaction receipt confirming acceptance.

#### obligation-escrow reject

Rejects an issued BoE obligation (Issued → Rejected). Burns the title (takes it out of circulation).

**Usage:**

```sh
trustvc obligation-escrow reject
```

**Interactive Prompts:**

- Path to BoE / obligation document
- Wallet/private key option
- Remark (optional)

**Output:**
Transaction receipt confirming rejection (and burn).

#### obligation-escrow discharge

Discharges an accepted BoE obligation (Accepted → Discharged). Burns the title.

**Usage:**

```sh
trustvc obligation-escrow discharge
```

**Interactive Prompts:**

- Path to BoE / obligation document
- Wallet/private key option
- Remark (optional)

**Output:**
Transaction receipt confirming discharge (and burn).

#### obligation-escrow status

Reads on-chain obligation / escrow status for a BoE document. This is read-only: no wallet or private key is requested. The CLI attaches the default network RPC/provider for the document’s chain (or `{NETWORK}_RPC` when set).

**Usage:**

```sh
trustvc obligation-escrow status
```

**Interactive Prompts:**

- Path to BoE / obligation document
- _Network, obligationRegistry, and token ID are extracted from the document_

**Output:**
Obligation and escrow status fields from the chain (status, registered, termination reason, escrow address, owner, holder, nominee when available).

#### obligation-escrow endorsement-chain

Fetches the BoE endorsement chain (transfers + obligation status events) via the network Infura/RPC. Remarks are decrypted with the credential `id`. Read-only: no wallet required.

**Usage:**

```sh
trustvc obligation-escrow endorsement-chain
```

**Interactive Prompts:**

- Path to BoE / obligation document
- *Network, obligationRegistry, token ID, and document `id` (encryption key) are extracted from the document*

**Output:**
Chronological list of endorsement-chain events (type, block, owner/holder, remark, tx hash).

#### obligation-escrow transfer-holder

Transfers the holder of a BoE obligation record. Nominate, endorse, transfer-owner-holder, and reject-transfer variants mirror `title-escrow` but operate on ObligationEscrow via `obligation-escrow <method>`.

**Usage:**

```sh
trustvc obligation-escrow transfer-holder
# Also:
#   nominate-transfer-owner, endorse-transfer-owner, transfer-owner-holder
#   reject-transfer-holder, reject-transfer-owner, reject-transfer-owner-holder
```

**Interactive Prompts:**

- Path to BoE / obligation document
- New address(es) where applicable
- Wallet/private key option
- Remark (optional)

**Output:**
Transaction receipt confirming the escrow action.

#### obligation-escrow return-to-issuer

Returns the BoE obligation to the issuer. Same rules as classic ETR: the connected wallet must be both the current beneficiary (owner) and the current holder.

**Who Can Execute:**
One wallet holding **both** the current beneficiary (owner) and current holder roles (`beneficiary == holder`). The CLI signs with a single wallet; there is no separate holder/beneficiary co-signature flow.

**Usage:**

```sh
trustvc obligation-escrow return-to-issuer
```

**Interactive Prompts:**

- Path to BoE / obligation document
  - _Network, obligationRegistry, token ID, and document ID are extracted from the document_
- Wallet/private key option
- Remark (optional)

**Output:**
Transaction receipt confirming return to issuer.

#### obligation-escrow accept-return-to-issuer

Accepts a returned BoE (issuer burn / shred).

**Who Can Execute:**
The connected wallet must hold the **accepter** role on the obligation registry (issuer burn / shred).

**Usage:**

```sh
trustvc obligation-escrow accept-return-to-issuer
```

**Interactive Prompts:**

- Path to BoE / obligation document
- Wallet/private key option
- Remark (optional)

**Output:**
Transaction receipt confirming acceptance (burn).

#### obligation-escrow reject-return-to-issuer

Rejects a returned BoE and restores it to escrow (issuer restore).

**Who Can Execute:**
The connected wallet must hold the **restorer** role on the obligation registry (restore the BoE to escrow).

**Usage:**

```sh
trustvc obligation-escrow reject-return-to-issuer
```

**Interactive Prompts:**

- Path to BoE / obligation document
- Wallet/private key option
- Remark (optional)

**Output:**
Transaction receipt confirming rejection (restore).

#### deploy-platform-paymaster

Deploys a `PlatformPaymaster` contract that sponsors gasless title-escrow, mint, and token registry deployment transactions. This is a **regular transaction** — you pay gas directly to deploy it. Only available on Sepolia and Amoy — beta feature, not for production use.

**Usage:**

```sh
trustvc deploy-platform-paymaster
```

**Interactive Prompts:**

- Network (Sepolia or Amoy)
- Salt to deterministically derive the paymaster address (0x-prefixed 32-byte hex, or any string — hashed into one)
- Platform owner address (optional, defaults to the deployer address)
- Daily sponsored-gas limit in wei (optional, `0` = unlimited)
- Wallet/private key option

**Output:**
Success message with the deployed paymaster address, plus transaction hash and explorer link.

Before it can sponsor anything, authorize what it covers and fund it with `paymaster-admin` (see below).

#### paymaster-admin \<method\>

Owner-only administration of a `PlatformPaymaster` contract. Every method is a **regular, non-gasless transaction** — the caller (the paymaster owner, except for `delegate-user`) pays gas directly. All methods except `delegate-user` prompt for network → paymaster address → wallet/private key option, then the method-specific fields below. Beta feature, testnets only (Sepolia, Amoy) — not for production use.

**Usage:**

```sh
trustvc paymaster-admin <method>
```

| Method                       | Extra prompts                                                    | Purpose                                                                                                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add-authorized-caller`      | caller address                                                   | Authorize an address to trigger sponsored title-escrow/registry calls                                                                                                                                                                                                           |
| `remove-authorized-caller`   | caller address                                                   | Deauthorize a caller                                                                                                                                                                                                                                                            |
| `add-title-escrow`           | title escrow address                                             | Authorize a title escrow so its calls can be sponsored                                                                                                                                                                                                                          |
| `remove-title-escrow`        | title escrow address                                             | Deauthorize a title escrow                                                                                                                                                                                                                                                      |
| `add-registry`               | registry address                                                 | Authorize a token registry so its calls can be sponsored                                                                                                                                                                                                                        |
| `remove-registry`            | registry address                                                 | Deauthorize a token registry                                                                                                                                                                                                                                                    |
| `set-daily-limit`            | daily limit in wei                                               | Set the global per-user daily sponsored-gas spend limit                                                                                                                                                                                                                         |
| `set-user-whitelist`         | user address, deployment credits (0-3)                           | Whitelist a user and set how many token registries they may deploy gaslessly                                                                                                                                                                                                    |
| `remove-user-from-whitelist` | user address                                                     | Reset a user's deployment credits to 0                                                                                                                                                                                                                                          |
| `fund-paymaster`             | amount in ETH                                                    | Deposit ETH into the paymaster's EntryPoint balance so it can sponsor gas                                                                                                                                                                                                       |
| `stake-paymaster`            | amount in ETH, unstake delay in seconds (default `86400`)        | Stake ETH on the EntryPoint — many bundlers, including Pimlico, require this before accepting sponsored UserOperations                                                                                                                                                          |
| `delegate-user`              | network, wallet/private key option (no paymaster address prompt) | Delegates a user's own EOA to the deployed `EIP7702Implementation` contract via a standalone EIP-7702 authorization. Every gasless command already does this automatically on its first sponsored UserOperation — run it explicitly only if you want to delegate ahead of time. |

**Output:**
Transaction hash and explorer link for the method's on-chain call.

#### Running any command gaslessly (`--gasless`)

Add `--gasless` to a supported command to submit it as an EIP-7702 smart-account UserOperation sponsored by a `PlatformPaymaster`, instead of a regular transaction paid from your own wallet. Only available on Sepolia and Amoy — beta feature, not for production use.

**Every title-escrow command** supports `--gasless`:

```sh
# Transfers
trustvc transfer-holder --gasless              # transfer holder
trustvc endorse-transfer-owner --gasless       # transfer/endorse beneficiary (owner)
trustvc transfer-owner-holder --gasless        # transfer both beneficiary and holder
trustvc nominate-transfer-owner --gasless      # nominate a new beneficiary

# Rejections
trustvc reject-transfer-holder --gasless
trustvc reject-transfer-owner --gasless
trustvc reject-transfer-owner-holder --gasless

# Return to issuer
trustvc return-to-issuer --gasless             # holder+beneficiary return the record
trustvc accept-return-to-issuer --gasless      # issuer accepts the return (burn)
trustvc reject-return-to-issuer --gasless      # issuer rejects the return (restore)
```

Plus mint and registry deployment:

```sh
trustvc mint --gasless
trustvc token-registry deploy --gasless
```

Compared to the regular flow, `--gasless`:

- Skips gas/dry-run prompts (Pimlico's bundler estimates and sponsors gas).
- Adds one prompt for the **PlatformPaymaster contract address**.
- Requires direct private-key access (encrypted wallet file, `--key`, `--key-file`, or `OA_PRIVATE_KEY`) — AWS KMS signers are not supported, since the raw key is needed to build the EIP-7702 smart account.
- Runs an eligibility check against the paymaster before submitting (see [Gasless Transactions user guide](#gasless-transactions-user-guide)) and fails fast with a specific error if it is not met.
- Role requirements are identical to the regular command (e.g. `transfer-holder --gasless` still requires the caller to be the current holder), except `mint --gasless` (gated by the token registry granting the paymaster `MINTER_ROLE`, not by caller identity) and `token-registry deploy --gasless` (gated by deployment credits from `paymaster-admin set-user-whitelist`).

**Output:** Same success message and explorer link as the regular command.

## Configuration

### Custom RPC Endpoints

You can override the default RPC endpoints for any network by setting environment variables. The format is `{NETWORK_NAME}_RPC`.

**Supported networks:**

- `SEPOLIA_RPC` - Sepolia testnet
- `MAINNET_RPC` - Ethereum mainnet
- `POL_RPC` - Polygon mainnet
- `AMOY_RPC` - Polygon Amoy testnet
- `XDC_RPC` - XDC Network
- `XDCAPOTHEM_RPC` - XDC Apothem testnet
- `STABILITY_RPC` - Stability mainnet
- `STABILITYTESTNET_RPC` - Stability testnet
- `ASTRON_RPC` - Astron mainnet
- `ASTRONTESTNET_RPC` - Astron testnet
- `LOCAL_RPC` - Local development network

**Example:**

```bash
# Set custom Sepolia RPC
export SEPOLIA_RPC=https://sepolia.infura.io/v3/your-api-key

# Use the CLI - when you select Sepolia network in the interactive prompt,
# it will automatically use your custom RPC
trustvc mint

# Set multiple custom RPCs
export MAINNET_RPC=https://mainnet.infura.io/v3/your-api-key
export POL_RPC=https://polygon-rpc.com
```

If no environment variable is set, the CLI will use the default RPC endpoint for each network.

### Gasless Transactions

⚠️ Beta, testnets only (Sepolia, Amoy) — not for production use.

Required for any command run with `--gasless`, `deploy-platform-paymaster`, or `paymaster-admin`:

- `PIMLICO_API_KEY` — get one from [dashboard.pimlico.io](https://dashboard.pimlico.io)
- `{NETWORK}_EIP7702_IMPL_ADDRESS` (e.g. `SEPOLIA_EIP7702_IMPL_ADDRESS`, `AMOY_EIP7702_IMPL_ADDRESS`) or the generic `EIP7702_IMPL_ADDRESS` — the deployed `EIP7702Implementation` contract address

See the [Gasless Transactions user guide](#gasless-transactions-user-guide) for the full setup workflow and eligibility rules.

## Development

### Setup

```sh
# Install dependencies
npm install

# Build the project
npm run build

# Link for local development (global `trustvc` will use this package)
npm link

# Run tests
npm test
```

### Project Structure

```
src/commands/
├── oa/
│   ├── sign.ts                      # Sign OpenAttestation documents
│   ├── wrap.ts                      # Wrap OpenAttestation documents
│   ├── unwrap.ts                    # Unwrap OpenAttestation documents
│   ├── encrypt.ts                   # Encrypt OA documents for safe sharing
│   └── decrypt.ts                   # Decrypt OA documents
├── token-registry/
│   ├── deploy.ts                    # Deploy token registry contracts
│   └── mint.ts                      # Mint tokens to registry
├── document-store/
│   ├── deploy.ts                    # Deploy document store contracts
│   ├── issue.ts                     # Issue document hashes
│   ├── revoke.ts                    # Revoke document hashes
│   ├── grant-role.ts                # Grant roles to accounts
│   ├── revoke-role.ts               # Revoke roles from accounts
│   └── transfer-ownership.ts        # Transfer document store ownership
├── title-escrow/
│   ├── transfer-holder.ts           # Transfer holder
│   ├── nominate-transfer-owner.ts   # Nominate beneficiary
│   ├── endorse-transfer-owner.ts    # Endorse beneficiary change
│   ├── transfer-owner-holder.ts     # Endorse full transfer
│   ├── return-to-issuer.ts          # Return to issuer
│   ├── accept-return-to-issuer.ts   # Accept returned document
│   ├── reject-return-to-issuer.ts   # Reject returned document
│   ├── reject-transfer-holder.ts    # Reject holder transfer
│   ├── reject-transfer-owner.ts     # Reject owner transfer
│   └── reject-transfer-owner-holder.ts  # Reject full transfer
├── obligation-registry/
│   ├── deploy.ts                    # Deploy Obligation Registry
│   └── mint.ts                      # Mint BoE token to obligationRegistry
├── obligation-escrow/
│   ├── accept.ts                    # Accept obligation
│   ├── reject.ts                    # Reject obligation
│   ├── discharge.ts                 # Discharge obligation
│   ├── status.ts                    # Read obligation / escrow status
│   ├── transfer-holder.ts           # Transfer BoE holder
│   ├── nominate-transfer-owner.ts   # Nominate BoE beneficiary
│   ├── endorse-transfer-owner.ts    # Endorse BoE beneficiary change
│   ├── transfer-owner-holder.ts     # Endorse full BoE transfer
│   ├── return-to-issuer.ts          # Return BoE to issuer
│   ├── accept-return-to-issuer.ts   # Accept returned BoE
│   ├── reject-return-to-issuer.ts   # Reject returned BoE
│   ├── reject-transfer-holder.ts    # Reject BoE holder transfer
│   ├── reject-transfer-owner.ts     # Reject BoE owner transfer
│   └── reject-transfer-owner-holder.ts  # Reject full BoE transfer
├── gasless/
│   ├── config.ts                     # Supported networks, env vars, Pimlico bundler URL
│   ├── client.ts                     # EIP-7702 smart account client setup
│   ├── common.ts                     # Shared prepareGaslessRun / prepareGaslessRegistryRun
│   ├── eligibility.ts                # Paymaster eligibility checks (authorized caller, whitelist, MINTER_ROLE)
│   ├── admin/                        # `paymaster-admin <method>` — owner-only PlatformPaymaster admin
│   ├── deploy/
│   │   ├── deploy-platform-paymaster.ts        # `deploy-platform-paymaster` command
│   │   └── deploy-token-registry-gasless.ts    # wired into `token-registry deploy --gasless`
│   ├── title-escrow/                 # wired into each `title-escrow` command's `--gasless` flag
│   └── token-regitsry/
│       └── mint.ts                   # wired into `mint --gasless`
├── transaction/
│   └── cancel.ts                    # Cancel a pending transaction
├── wallet/
│   ├── create.ts                    # Create encrypted wallet
│   ├── encrypt.ts                   # Encrypt private key to wallet
│   └── decrypt.ts                   # Decrypt wallet file
├── verify.ts                        # Verify W3C, OA, ETR, and BoE documents (unified pipeline)
└── w3c/
    ├── did.ts                       # Generate DID
    ├── key-pair.ts                  # Generate key pairs
    ├── sign.ts                      # Sign W3C credentials
    ├── vp-sign.ts                   # Create and sign a verifiable presentation
    └── credentialStatus/
        ├── create.ts                # Create credential status list
        └── update.ts                # Update credential status list
```

## Obligation Registry user guide

User guide for electronic Bill of Exchange (BoE) / obligation flows with `trustvc-cli`.

Classic transferable records (eBL / Token Registry + Title Escrow) use different commands. This section covers **only** Obligation Registry.

For library / SDK details, see the TrustVC README [§7c Obligation Registry (BoE)](https://github.com/TrustVC/trustvc/blob/main/README.md#c-obligation-registry-boe).

SDK imports use the **root** package with the `*ObligationRegistry` suffix (no clash with classic ETR helpers):

```ts
import {
  mintObligationRegistry,
  acceptObligationRegistry,
  DocumentBuilder,
  verifyDocument,
} from '@trustvc/trustvc';
```

Build BoE credentials with `DocumentBuilder.obligationCredentialStatus({ obligationRegistry, chain, chainId, rpcProviderUrl })` (credential status uses `type: 'TransferableRecords'` plus an `obligationRegistry` field — not `tokenRegistry`). On-chain minting is separate via `obligation-registry mint` / `mintObligationRegistry`.

### Who this is for

Operators and integrators who:

- Deploy an Obligation Registry on a supported network
- Mint a signed BoE credential on-chain
- Accept, reject, discharge, transfer, or return the obligation
- Verify a BoE document

You do **not** need to call the TypeScript SDK directly — the CLI wraps it with interactive prompts.

### Before you start

1. **Install the CLI** — `npm install -g @trustvc/trustvc-cli` or `npx @trustvc/trustvc-cli <command>`
2. **Node.js 22.19.5+**
3. **A wallet** — encrypted wallet file (recommended), private key, or key file
4. **A signed BoE document** — set `credentialStatus.obligationRegistry`, then sign with `trustvc w3c-sign` (not `tokenRegistry`)
5. **Network access** — select network in prompts, or set a custom RPC (e.g. `export SEPOLIA_RPC=…`)

### Classic vs Obligation — pick the right commands

| Task            | Classic ETR                    | Obligation / BoE             |
| --------------- | ------------------------------ | ---------------------------- |
| Deploy registry | `token-registry deploy`        | `obligation-registry deploy` |
| Mint            | `mint` / `token-registry mint` | `obligation-registry mint`   |
| Escrow actions  | `title-escrow …`               | `obligation-escrow …`        |
| Verify          | `verify` (ETR and BoE)         | `verify` (same command)      |

Using classic commands on a BoE document will fail or skip obligation checks. Using obligation commands on a classic eBL document will fail extraction (missing `obligationRegistry`).

### Typical workflow

```text
1. Deploy Obligation Registry
2. Put the registry address into your BoE credential status
3. Sign the credential with `trustvc w3c-sign`
4. Mint (issuer wallet)
5. Accept or reject (holder) — or transfer / discharge / return as needed
6. Verify with `trustvc verify`
```

Signing/building the VC can also be done with TrustVC library tools or your app (`DocumentBuilder` + `obligationRegistry`). With the CLI, use `w3c-sign` before minting.

### Step-by-step

**1. Deploy** — `trustvc obligation-registry deploy` (network, name/symbol, optional factory reuse, wallet, dry-run).

**2. Sign** — put the deployed registry into `credentialStatus.obligationRegistry`, then run `trustvc w3c-sign` on the unsigned BoE JSON.

**3. Mint** — `trustvc obligation-registry mint` with the signed BoE JSON from `w3c-sign` (registry, network, token ID, document ID are extracted).

**4. Accept or reject (holder)** — `trustvc obligation-escrow accept` or `reject` while **beneficiary ≠ holder**. Accept moves Issued → Accepted. Reject moves Issued → Rejected and burns the title.

**5. Status / history** — `trustvc obligation-escrow status` reads `Issued` / `Accepted` / `Rejected` / `Discharged`, registration, termination reason, and escrow parties. `trustvc obligation-escrow endorsement-chain` prints the full on-chain history (transfers + status events).

**6. Transfers (optional)** — `obligation-escrow transfer-holder`, nominate/endorse/reject-transfer variants mirror `title-escrow`.

**7. Discharge (optional)** — `trustvc obligation-escrow discharge` by **beneficiary** after Accepted (sets Discharged and burns).

**8. Return to issuer** — same as classic ETR: **beneficiary == holder**, then a wallet with registry **restorer** runs `reject-return-to-issuer` (restore) or with **accepter** runs `accept-return-to-issuer` (burn / shred). No Rejected/Discharged status requirement.

**9. Verify** — `trustvc verify` (auto-detects BoE vs ETR).

### Who can run what

| Action                                | Typical role                                                    |
| ------------------------------------- | --------------------------------------------------------------- |
| `obligation-registry deploy`          | Deployer / issuer org                                           |
| `obligation-registry mint`            | Issuer (registry minter)                                        |
| `obligation-escrow accept` / `reject` | Holder (roles split)                                            |
| `obligation-escrow discharge`         | Beneficiary                                                     |
| Transfer / nominate / endorse         | Current holder or beneficiary per Title Escrow–style rules      |
| `return-to-issuer`                    | Dual role (beneficiary == holder), same as ETR                  |
| `accept-return-to-issuer`             | Connected wallet with registry **accepter** role (burn / shred) |
| `reject-return-to-issuer`             | Connected wallet with registry **restorer** role (restore)      |
| `obligation-escrow status`            | Anyone with the document (read-only RPC; no signing key)        |
| `obligation-escrow endorsement-chain` | Anyone with the document (read-only RPC; no signing key)        |
| `verify`                              | Anyone with the document (+ RPC when on-chain checks run)       |

### What the CLI reads from your document

For mint, escrow, and related flows, the CLI extracts:

- Network
- `obligationRegistry` address
- Token ID
- Document ID (remark encryption key when remarks are set)

If extraction fails with a message about classic transferable records / `tokenRegistry`, you are using the wrong document type or command family.

## Gasless Transactions user guide

> ⚠️ **Beta feature, testnets only.** Gasless transactions are only supported on Sepolia and Amoy and are still in beta. Do not use gasless transactions, or a `PlatformPaymaster`/`EIP7702Implementation` contract, on mainnet or in production.

User guide for running title-escrow, mint, and token registry deployment actions as **sponsored** transactions — the caller submits an EIP-7702 smart-account UserOperation instead of a regular transaction, and a `PlatformPaymaster` contract pays the gas (via a [Pimlico](https://pimlico.io) bundler).

### Who gasless transactions are for

- **Paymaster owners / platform operators** who deploy and administer a `PlatformPaymaster` and decide what it sponsors.
- **End users** who want to run title-escrow, mint, or token registry deployment commands without holding native gas on Sepolia or Amoy.

### Supported networks

Gasless transactions require a deployed `PlatformPaymaster` and `EIP7702Implementation` contract, which today only exist on:

- **Sepolia**
- **Amoy** (Polygon testnet)

Every other network is rejected up front with an error telling you to re-run without `--gasless`.

### Required environment variables

| Variable                                                   | Required for              | Notes                                                                                                                                                                                     |
| ---------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PIMLICO_API_KEY`                                          | Every gasless transaction | Get one from [dashboard.pimlico.io](https://dashboard.pimlico.io). Never logged — the CLI redacts it from error output.                                                                   |
| `{NETWORK}_EIP7702_IMPL_ADDRESS` or `EIP7702_IMPL_ADDRESS` | Every gasless transaction | The deployed `EIP7702Implementation` contract address, e.g. `SEPOLIA_EIP7702_IMPL_ADDRESS`, `AMOY_EIP7702_IMPL_ADDRESS`. The network-scoped variable takes priority over the generic one. |
| `{NETWORK}_RPC`                                            | Optional                  | Overrides the default public RPC used for gasless reads/client setup, same convention as [Custom RPC Endpoints](#custom-rpc-endpoints).                                                   |

### How eligibility is checked

Before submitting any sponsored UserOperation, the CLI reads the `PlatformPaymaster` contract on-chain and fails fast with a specific error if any check doesn't pass. There are three separate gates depending on the action:

**Title-escrow actions and `mint` on the registry side** (`transfer-holder`, `nominate-transfer-owner`, `return-to-issuer`, etc.):

1. The paymaster contract exists at the given address.
2. The title escrow (or, for registry-level actions, the token registry) being acted on is authorized (`paymaster-admin add-title-escrow` / `add-registry`).
3. The caller is an authorized caller (`paymaster-admin add-authorized-caller`).
4. The caller's daily sponsored-gas spend limit has not been reached (`paymaster-admin set-daily-limit`; `0` = unlimited).
5. The paymaster has a non-zero ETH deposit at the EntryPoint (`paymaster-admin fund-paymaster`).

Additionally, the connected wallet must currently hold the role the action requires (e.g. `transfer-holder --gasless` requires the caller to be the current holder) — same rule as the regular, non-gasless command.

**`mint --gasless`** is gated differently — there is no authorized-caller check. Instead:

1. The paymaster contract exists.
2. The token registry has granted the **`PlatformPaymaster` contract itself** `MINTER_ROLE` (the token registry owner's call, not the paymaster owner's — e.g. via `document-store grant-role`–style `grantRole` on the registry).
3. The token registry is authorized on the paymaster (`paymaster-admin add-registry`).
4. The paymaster has a non-zero EntryPoint deposit.

**`token-registry deploy --gasless`** is credit-gated:

1. The paymaster contract exists.
2. The caller has at least one deployment credit (`paymaster-admin set-user-whitelist`, 0-3 credits).
3. The paymaster has a non-zero EntryPoint deposit.

### Typical setup workflow

```text
1. Deploy a PlatformPaymaster:          trustvc deploy-platform-paymaster
2. Authorize what it may sponsor:       trustvc paymaster-admin add-title-escrow / add-registry / add-authorized-caller
3. Fund and stake it:                   trustvc paymaster-admin fund-paymaster / stake-paymaster
4. (mint only) grant MINTER_ROLE to the paymaster on the token registry
5. (deploy only) whitelist deployers:   trustvc paymaster-admin set-user-whitelist
6. Run any supported command with --gasless
```

The end user's own EOA is delegated to the `EIP7702Implementation` contract automatically on their first sponsored UserOperation — there is no separate "activate my account" step. `paymaster-admin delegate-user` exists only if you want to do that delegation ahead of time as its own (regular, non-gasless) transaction.

### Who can run what (gasless)

| Action                                                                    | Who                                                                                                                     |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `deploy-platform-paymaster`                                               | Anyone (deploys their own paymaster; pays gas directly)                                                                 |
| `paymaster-admin <method>` (except `delegate-user`)                       | The paymaster owner                                                                                                     |
| `paymaster-admin delegate-user`                                           | Any user, for their own EOA                                                                                             |
| `<title-escrow command> --gasless`                                        | Same role as the regular command, plus: must be an authorized caller on the paymaster                                   |
| `accept-return-to-issuer --gasless` / `reject-return-to-issuer --gasless` | Same as the regular command — enforced by the registry contract, not by an authorized-caller check                      |
| `mint --gasless`                                                          | Anyone, once the token registry has granted the paymaster `MINTER_ROLE` and the registry is authorized on the paymaster |
| `token-registry deploy --gasless`                                         | Anyone the paymaster owner has whitelisted with deployment credits                                                      |

### Troubleshooting

Every eligibility failure names the specific check and the admin command that fixes it, for example:

```text
This account cannot perform a gasless transaction: caller 0x... is not an authorized
caller on the PlatformPaymaster (0x...). Ask the paymaster owner to call addAuthorizedCaller first.
```

Common causes:

- **"is not authorized on the PlatformPaymaster"** — run `paymaster-admin add-title-escrow` / `add-registry` for the address in the message.
- **"is not an authorized caller"** — run `paymaster-admin add-authorized-caller` for your address.
- **"daily sponsored-gas limit reached"** — wait for the daily window to reset, or ask the owner to raise/clear it with `paymaster-admin set-daily-limit`.
- **"has no ETH deposited at the EntryPoint"** — ask the owner to run `paymaster-admin fund-paymaster`.
- **"does not hold MINTER_ROLE"** (mint only) — the token registry owner must grant the paymaster contract `MINTER_ROLE`.
- **"has no deployment credits"** (deploy only) — ask the owner to run `paymaster-admin set-user-whitelist`.
- **"Gasless transactions require direct access to a private key"** — you're using an AWS KMS signer; gasless needs the raw key to build the EIP-7702 smart account. Use an encrypted wallet file, `--key`, `--key-file`, or `OA_PRIVATE_KEY` instead.
- **"PIMLICO_API_KEY environment variable is required"** — get a key from [dashboard.pimlico.io](https://dashboard.pimlico.io) and set it in your environment.

## License

Apache-2.0
