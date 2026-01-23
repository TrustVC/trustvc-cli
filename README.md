# TrustVC CLI

A comprehensive command-line interface for managing W3C Verifiable Credentials, OpenAttestation documents, blockchain-based token registries, and transferable records. Built with modern cryptographic standards and multi-network blockchain support.

## Features

- ✅ **Modern Cryptosuites**: Full support for ECDSA-SD-2023 and BBS-2023
- ✅ **Key Pair Generation**: Generate cryptographic key pairs with Multikey format
- ✅ **DID Management**: Create and manage did:web identifiers
- ✅ **W3C Verifiable Credentials**: Sign and manage W3C verifiable credentials
- ✅ **OpenAttestation**: Sign OpenAttestation v2/v3 documents
- ✅ **Token Registry**: Mint tokens to blockchain-based token registries
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

# Sign a verifiable credential
trustvc w3c-sign

# Create a credential status list
trustvc credential-status-create

# Update a credential status list
trustvc credential-status-update
```

### OpenAttestation Documents

```sh
# Sign OpenAttestation documents
trustvc oa-sign
```

### Token Registry & Title Escrow

```sh
# Mint a token to a registry
trustvc mint

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

- **Credential Status**: Provides commands to create and update W3C credential status lists for managing credential revocation and suspension.

### OpenAttestation

- **Document Signing**: Uses `signOA` to cryptographically sign OpenAttestation v2 and v3 documents with private keys.

### Blockchain Operations

- **Token Registry**: Uses `mint` to mint document hashes (tokenIds) to blockchain-based token registries across multiple networks (Ethereum, Polygon, XDC, Stability, Astron).

- **Title Escrow**: Provides comprehensive transferable records management including holder transfers, beneficiary nominations, endorsements, returns, and rejections using smart contracts.

## Commands

### Available Commands

| Category            | Command                                                                      | Description                                                |
| ------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **W3C Credentials** | [`key-pair-generation`](#key-pair-generation)                                | Generate cryptographic key pairs (ECDSA-SD-2023, BBS-2023) |
|                     | [`did-web`](#did-web)                                                        | Create did:web identifiers from key pairs                  |
|                     | [`w3c-sign`](#w3c-sign)                                                      | Sign W3C verifiable credentials                            |
|                     | [`credential-status-create`](#credential-status-create)                      | Create credential status lists                             |
|                     | [`credential-status-update`](#credential-status-update)                      | Update credential status (revoke/suspend)                  |
| **OpenAttestation** | [`oa-sign`](#oa-sign)                                                        | Sign OpenAttestation v2/v3 documents                       |
| **Token Registry**  | [`mint`](#mint)                                                              | Mint tokens to blockchain registries                       |
|                     | `token-registry mint`                                                        | Alternative: `mint`                                        |
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

All title-escrow and token registry commands require a wallet or private key to sign transactions. You can provide your private key in one of the following ways:

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
├── token-registry/
│   └── mint.ts                      # Mint tokens to registry
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
└── w3c/
    ├── did.ts                       # Generate DID
    ├── key-pair.ts                  # Generate key pairs
    ├── sign.ts                      # Sign W3C credentials
    └── credentialStatus/
        ├── create.ts                # Create credential status list
        └── update.ts                # Update credential status list
```

## License

Apache-2.0
