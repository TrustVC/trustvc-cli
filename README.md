# TrustVC CLI

A comprehensive command-line interface for managing W3C Verifiable Credentials, OpenAttestation documents, blockchain-based token registries, and transferable records. Built with modern cryptographic standards and multi-network blockchain support.

## Features

- ✅ **Modern Cryptosuites**: Full support for ECDSA-SD-2023 and BBS-2023
- ✅ **Key Pair Generation**: Generate cryptographic key pairs with Multikey format
- ✅ **DID Management**: Create and manage did:web identifiers
- ✅ **W3C Verifiable Credentials**: Sign, verify and manage W3C verifiable credentials
- ✅ **OpenAttestation**: Sign, verify and wrap/unwrap OpenAttestation v2/v3 documents
- ✅ **Token Registry**: Mint tokens to blockchain-based token registries
- ✅ **Document Store**: Deploy and manage document store contracts
- ✅ **Title Escrow**: Complete transferable records management (holder/beneficiary transfers)
- ✅ **Credential Status**: Create and update W3C credential status lists
- ✅ **W3C Standards**: Compliant with latest W3C DID and Verifiable Credentials specifications
- ✅ **Multi-Network Support**: Ethereum, Polygon, XDC, Stability, and Astron networks
- ✅ **Interactive CLI**: User-friendly prompts for all operations

## Powered By

This CLI leverages the TrustVC package:

- [`@trustvc/trustvc`](https://github.com/TrustVC/trustvc) - Core library for W3C credentials, OpenAttestation, token registries, and blockchain operations

## Table of Contents

- [Features](#features)
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

## Installation

Install the CLI globally:

```sh
npm install -g @trustvc/trustvc-cli
```

Or use with npx (no installation required):

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

# Verify a W3C document
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

## How It Works

### W3C Credentials

- **Key Pair Generation**: Uses `generateKeyPair` from `@trustvc/trustvc` to create cryptographic key pairs supporting ECDSA-SD-2023 and BBS-2023 cryptosuites in Multikey format.

- **DID Creation**: Uses `issueDID` to generate did:web identifiers, allowing self-hosted DIDs as unique identifiers in decentralized systems.

- **Credential Signing**: Uses `signW3C` to sign verifiable credentials with did:web identifiers and modern cryptosuites.

- **Credential Verification**: Uses `verifyDocument` to verify W3C verifiable credentials.

- **Credential Status**: Provides commands to create and update W3C credential status lists for managing credential revocation and suspension.

### OpenAttestation

- **Document Signing**: Uses `signOA` to cryptographically sign OpenAttestation v2 and v3 documents with private keys.

- **Document Verification**: Uses `verifyDocument` to verify OpenAttestation documents.

- **Document Wrapping**: Uses `wrapOA` to wrap OpenAttestation documents.

- **Document Unwrapping**: Uses `unwrapOA` to unwrap OpenAttestation documents.

### Blockchain Operations

- **Token Registry**: Deploy token registry contracts and mint document hashes (tokenIds) to blockchain-based token registries across multiple networks (Ethereum, Polygon, XDC, Stability, Astron).

- **Document Store**: Deploy document store contracts and use `documentStoreIssue` and `documentStoreRevoke` to issue and revoke document hashes in deployed contracts.

- **Title Escrow**: Provides comprehensive transferable records management including holder transfers, beneficiary nominations, endorsements, returns, and rejections using smart contracts.

## Commands

### Available Commands

| Category            | Command                                                                      | Description                                                |
| ------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **W3C Credentials** | [`key-pair-generation`](#key-pair-generation)                                | Generate cryptographic key pairs (ECDSA-SD-2023, BBS-2023) |
|                     | [`did-web`](#did-web)                                                        | Create did:web identifiers from key pairs                  |
|                     | [`w3c-sign`](#w3c-sign)                                                      | Sign W3C verifiable credentials                            |
|                     | [`verify`](#verify)                                                          | Verify W3C verifiable credentials                          |
|                     | [`credential-status-create`](#credential-status-create)                      | Create credential status lists                             |
|                     | [`credential-status-update`](#credential-status-update)                      | Update credential status (revoke/suspend)                  |
| **OpenAttestation** | [`oa-sign`](#oa-sign)                                                        | Sign OpenAttestation v2/v3 documents                       |
|                     | [`verify`](#verify)                                                          | Verify OpenAttestation documents                           |
|                     | [`oa-wrap`](#oa-wrap)                                                        | Wrap OpenAttestation documents                             |
|                     | [`oa-unwrap`](#oa-unwrap)                                                    | Unwrap OpenAttestation documents                           |
| **Token Registry**  | [`token-registry deploy`](#token-registry-deploy)                            | Deploy token registry contracts                            |
|                     | [`mint`](#mint)                                                              | Mint tokens to blockchain registries                       |
|                     | `token-registry mint`                                                        | Alternative: `mint`                                        |
| **Document Store**  | [`document-store deploy`](#document-store-deploy)                            | Deploy document store contracts                            |
|                     | [`document-store issue`](#document-store-issue)                              | Issue document hashes                                      |
|                     | [`document-store revoke`](#document-store-revoke)                            | Revoke document hashes                                     |
|                     | [`document-store grant-role`](#document-store-grant-role)                    | Grant roles to accounts                                    |
|                     | [`document-store revoke-role`](#document-store-revoke-role)                  | Revoke roles from accounts                                 |
|                     | [`document-store transfer-ownership`](#document-store-transfer-ownership)    | Transfer document store ownership                          |
| **Wallet**          | [`wallet create`](#wallet-create)                                            | Create a new encrypted wallet file                         |
|                     | [`wallet encrypt`](#wallet-encrypt)                                          | Encrypt a wallet using a private key                       |
|                     | [`wallet decrypt`](#wallet-decrypt)                                          | Decrypt an encrypted wallet file                           |
| **Title Escrow**    | [`transfer-holder`](#title-escrow-transfer-holder)                           | Transfer document holder                                   |
|                     | `title-escrow transfer-holder`                                               | Alternative: `transfer-holder`                             |
|                     | [`nominate-transfer-owner`](#title-escrow-nominate-transfer-owner)           | Nominate new beneficiary                                   |
|                     | `title-escrow nominate-transfer-owner`                                       | Alternative: `nominate-transfer-owner`                     |
|                     | [`endorse-transfer-owner`](#title-escrow-endorse-transfer-owner)             | Endorse beneficiary change                                 |
|                     | `title-escrow endorse-transfer-owner`                                        | Alternative: `endorse-transfer-owner`                      |
|                     | [`transfer-owner-holder`](#title-escrow-transfer-owner-holder)               | Endorse full ownership transfer                            |
|                     | `title-escrow transfer-owner-holder`                                         | Alternative: `transfer-owner-holder`                       |
|                     | [`return-to-issuer`](#title-escrow-return-to-issuer)                         | Return document to issuer                                  |
|                     | `title-escrow return-to-issuer`                                              | Alternative: `return-to-issuer`                            |
|                     | [`accept-return-to-issuer`](#title-escrow-accept-return-to-issuer)           | Accept returned document                                   |
|                     | `title-escrow accept-return-to-issuer`                                       | Alternative: `accept-return-to-issuer`                     |
|                     | [`reject-return-to-issuer`](#title-escrow-reject-return-to-issuer)           | Reject returned document                                   |
|                     | `title-escrow reject-return-to-issuer`                                       | Alternative: `reject-return-to-issuer`                     |
|                     | [`reject-transfer-holder`](#title-escrow-reject-transfer-holder)             | Reject holder transfer                                     |
|                     | `title-escrow reject-transfer-holder`                                        | Alternative: `reject-transfer-holder`                      |
|                     | [`reject-transfer-owner`](#title-escrow-reject-transfer-owner)               | Reject owner transfer                                      |
|                     | [`reject-transfer-owner-holder`](#title-escrow-reject-transfer-owner-holder) | Reject full transfer                                       |
|                     | `title-escrow reject-transfer-owner-holder`                                  | Alternative: `reject-transfer-owner-holder`                |

---

### Wallet/Private Key Options

All title-escrow, token registry, and document-store commands require a wallet or private key to sign transactions. You can provide your private key in one of the following ways:

**Select wallet/private key option:**

- **Encrypted wallet file (recommended)** - Use an encrypted JSON wallet file for secure key storage
- **Environment variable (OA_PRIVATE_KEY)** - Set your private key in the `OA_PRIVATE_KEY` environment variable
- **Private key file** - Provide a file containing your private key
- **Private key directly** - Enter your private key directly (not recommended for production)

---

### Detailed Command Reference

<details>
<summary><h4 id="key-pair-generation">key-pair-generation</h4></summary>

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

</details>

<details>
<summary><h4 id="did-web">did-web</h4></summary>

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

</details>

<details>
<summary><h4 id="w3c-sign">w3c-sign</h4></summary>

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

</details>

<details>
<summary><h4 id="verify">verify</h4></summary>

Verifies a W3C or OA document using respective verification methods.

**Usage:**

```sh
trustvc verify
```

**Interactive Prompts:**

- Path to document JSON file
- [If network required but no network detected]: Select network

**Output:**
Verifies the document integrity, status, and issuer identity.

**Supported Formats:**

- W3C Verifiable Credential
- OpenAttestation v2
- OpenAttestation v3

</details>

<details>
<summary><h4 id="credential-status-create">credential-status-create</h4></summary>

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

</details>

<details>
<summary><h4 id="credential-status-update">credential-status-update</h4></summary>

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

</details>

<details>
<summary><h4 id="oa-sign">oa-sign</h4></summary>

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

</details>

<details>
<summary><h4 id="oa-wrap">oa-wrap</h4></summary>

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

</details>

<details>
<summary><h4 id="oa-unwrap">oa-unwrap</h4></summary>

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

</details>

<details>
<summary><h4 id="mint">mint</h4></summary>

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

</details>

<details>
<summary><h4 id="token-registry-deploy">token-registry deploy</h4></summary>

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

</details>

<details>
<summary><h4 id="token-registry-mint">token-registry mint</h4></summary>

Alternative command for minting tokens. Functionally identical to `mint`.

**Usage:**

```sh
# Short form
trustvc mint

# Or with prefix
trustvc token-registry mint
```

</details>

<details>
<summary><h4 id="document-store-deploy">document-store deploy</h4></summary>

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

</details>

<details>
<summary><h4 id="document-store-issue">document-store issue</h4></summary>

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

</details>

<details>
<summary><h4 id="document-store-revoke">document-store revoke</h4></summary>

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

</details>

<details>
<summary><h4 id="document-store-grant-role">document-store grant-role</h4></summary>

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

</details>

<details>
<summary><h4 id="document-store-revoke-role">document-store revoke-role</h4></summary>

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

</details>

<details>
<summary><h4 id="document-store-transfer-ownership">document-store transfer-ownership</h4></summary>

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

</details>

<details>
<summary><h4 id="wallet-create">wallet create</h4></summary>

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

</details>

<details>
<summary><h4 id="wallet-encrypt">wallet encrypt</h4></summary>

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

</details>

<details>
<summary><h4 id="wallet-decrypt">wallet decrypt</h4></summary>

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

</details>

<details>
<summary><h4 id="title-escrow-transfer-holder">title-escrow transfer-holder</h4></summary>

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

</details>

<details>
<summary><h4 id="title-escrow-nominate-transfer-owner">title-escrow nominate-transfer-owner</h4></summary>

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

</details>

<details>
<summary><h4 id="title-escrow-endorse-transfer-owner">title-escrow endorse-transfer-owner</h4></summary>

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

</details>

<details>
<summary><h4 id="title-escrow-transfer-owner-holder">title-escrow transfer-owner-holder</h4></summary>

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

</details>

<details>
<summary><h4 id="title-escrow-return-to-issuer">title-escrow return-to-issuer</h4></summary>

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

</details>

<details>
<summary><h4 id="title-escrow-accept-return-to-issuer">title-escrow accept-return-to-issuer</h4></summary>

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

</details>

<details>
<summary><h4 id="title-escrow-reject-return-to-issuer">title-escrow reject-return-to-issuer</h4></summary>

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

</details>

<details>
<summary><h4 id="title-escrow-reject-transfer-holder">title-escrow reject-transfer-holder</h4></summary>

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

</details>

<details>
<summary><h4 id="title-escrow-reject-transfer-owner">title-escrow reject-transfer-owner</h4></summary>

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

</details>

<details>
<summary><h4 id="title-escrow-reject-transfer-owner-holder">title-escrow reject-transfer-owner-holder</h4></summary>

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

</details>

## Configuration

### Custom RPC Endpoints

You can override the default RPC endpoints for any network by setting environment variables. The format is `{NETWORK_NAME}_RPC`.

**Supported networks:**

- `SEPOLIA_RPC` - Sepolia testnet
- `MAINNET_RPC` - Ethereum mainnet
- `MATIC_RPC` - Polygon mainnet
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
export MATIC_RPC=https://polygon-rpc.com
```

If no environment variable is set, the CLI will use the default RPC endpoint for each network.

## Development

### Setup

```sh
# Install dependencies
npm install

# Build the project
npm run build

# Link for local development
npm link

# Run tests
npm test
```

### Project Structure

```
src/commands/
├── oa/
│   └── sign.ts                      # Sign OpenAttestation documents
│   └── wrap.ts                      # Wrap OpenAttestation documents
│   └── unwrap.ts                    # Unwrap OpenAttestation documents
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
├── wallet/
│   ├── create.ts                    # Create encrypted wallet
│   ├── encrypt.ts                   # Encrypt private key to wallet
│   └── decrypt.ts                   # Decrypt wallet file
└── w3c/
    ├── did.ts                       # Generate DID
    ├── key-pair.ts                  # Generate key pairs
    ├── sign.ts                      # Sign W3C credentials
    └── credentialStatus/
        ├── create.ts                # Create credential status list
        └── update.ts                # Update credential status list
    └── verify.ts                    # Verify W3C or OA document
```

## License

Apache-2.0
