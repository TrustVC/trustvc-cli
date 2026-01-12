# TrustVC CLI

A command-line interface tool for working with Decentralized Identifiers (DIDs), cryptographic key pairs, token registries, and credential status management using modern cryptosuites.

## Features

- ✅ **Modern Cryptosuites**: Full support for ECDSA-SD-2023 and BBS-2023
- ✅ **Key Pair Generation**: Generate cryptographic key pairs with Multikey format
- ✅ **DID Management**: Create and manage did:web identifiers
- ✅ **Token Registry**: Mint tokens to blockchain-based token registries
- ✅ **Credential Status**: Create and update W3C credential status lists
- ✅ **W3C Standards**: Compliant with latest W3C DID and Verifiable Credentials specifications
- ✅ **Multi-Network Support**: Ethereum, Polygon, XDC, Stability, and Astron networks

## Powered By

This CLI leverages the TrustVC package:

- [`@trustvc/trustvc`](https://github.com/TrustVC/trustvc) - Key pair and DID generation

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Commands](#commands)
  - [`trustvc key-pair-generation`](#trustvc-key-pair-generation)
  - [`trustvc did-web`](#trustvc-did-web)
  - [`trustvc credential-status-create`](#trustvc-credential-status-create)
  - [`trustvc credential-status-update`](#trustvc-credential-status-update)
  - [`trustvc mint`](#trustvc-mint)
  - [`trustvc token-registry mint`](#trustvc-token-registry-mint)
- [Configuration](#configuration)
- [Development](#development)

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

```sh
# Generate a key pair
trustvc key-pair-generation

# Create a DID from the key pair
trustvc did-web

# Create a credential status list
trustvc credential-status-create

# Update a credential status list
trustvc credential-status-update

# Mint a token to a registry
trustvc mint
```

## How It Works

- **Generating Key Pairs**: The CLI uses the `generateKeyPair` function from `@trustvc/trustvc` to generate cryptographic key pairs. These key pairs support modern cryptosuites (ECDSA-SD-2023, BBS-2023) and use the Multikey format for compatibility with W3C standards.

- **Generating Well-Known DID**: The CLI uses the `issueDID` function from `@trustvc/trustvc` to generate a did:web identifier. This allows users to self-host their DID as a unique identifier in decentralized systems.

- **Credential Status Management**: The CLI provides commands to create and update W3C credential status lists for managing the revocation status of verifiable credentials.

- **Token Registry Minting**: The CLI uses the `mint` function from `@trustvc/trustvc` to mint document hashes to blockchain-based token registries, supporting multiple networks including Ethereum, Polygon, XDC, Stability, and Astron.

## Commands

### `trustvc key-pair-generation`

Generates cryptographic key pairs for modern cryptosuites (ECDSA-SD-2023, BBS-2023). These key pairs are used to create DIDs.

**Interactive prompts:**
- Select encryption algorithm (ECDSA-SD-2023 or BBS-2023)
- Enter seed (optional, BBS-2023 only)
- Specify output directory

**Output:** Creates a `keypair.json` file containing:
- `type`: Multikey
- `publicKeyMultibase`: Public key in multibase format
- `secretKeyMultibase`: Secret key in multibase format
- `seedBase58`: Seed (if provided for BBS-2023)

**Example:**
```sh
trustvc key-pair-generation
```

### `trustvc did-web`

Generates a did:web identifier from an existing key pair. Supports modern Multikey format for compatibility with latest W3C standards.

**Interactive prompts:**
- Path to key pair JSON file
- Select cryptosuite (must match the key pair)
- Domain name for did:web hosting
- Output directory

**Output:** Creates two files:
- `wellknown.json`: DID document for hosting at `/.well-known/did.json`
- `didKeyPairs.json`: Key pair information with DID references

**Example:**
```sh
trustvc did-web
```

### `trustvc credential-status-create`

Creates a new W3C credential status list for managing the revocation status of verifiable credentials.

**Interactive prompts:**
- Path to key pair JSON file
- Select cryptosuite (ECDSA-SD-2023 or BBS-2023)
- Hosting URL for the credential status list
- Output directory
- Status list length (optional)

**Output:** Creates a signed credential status list file.

**Example:**
```sh
trustvc credential-status-create
```

### `trustvc credential-status-update`

Updates an existing W3C credential status list to revoke or suspend credentials.

**Interactive prompts:**
- Path to existing credential status file
- Path to key pair JSON file
- Output directory
- Credential index to update

**Output:** Updates the credential status list file.

**Example:**
```sh
trustvc credential-status-update
```

### `trustvc mint`

Mints a document hash (tokenId) to a token registry smart contract on the blockchain. This is a shorthand command for `trustvc token-registry mint`.

**Interactive prompts:**
- Select network (Sepolia, Mainnet, Polygon, XDC, Stability, Astron, etc.)
- Token registry contract address
- Document hash (tokenId) to mint
- Beneficiary address (initial recipient)
- Holder address (initial holder)
- Wallet/private key option:
  - Encrypted wallet file (recommended)
  - Environment variable (OA_PRIVATE_KEY)
  - Private key file
  - Private key directly
- Remark (optional)
- Encryption key for document (optional, if remark provided)

**Output:** Transaction receipt with:
- Transaction hash
- Block number
- Gas used and transaction cost
- Etherscan link for transaction details

**Example:**
```sh
trustvc mint
```

### `trustvc token-registry mint`

Alternative command for minting tokens. Functionally identical to `trustvc mint`.

**Example:**
```sh
trustvc token-registry mint
```

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
├── src/
│   ├── commands/
│   │   ├── token-registry/
│   │   │   ├── mint.ts              # Mint command shorthand
│   │   │   └── token-registry.ts    # Token registry operations
│   │   └── w3c/
│   │       ├── did.ts               # DID generation command
│   │       ├── key-pair.ts          # Key pair generation command
│   │       └── credentialStatus/
│   │           ├── create.ts        # Create credential status
│   │           └── update.ts        # Update credential status
│   ├── utils/
│   │   ├── wallet.ts                # Wallet and signer utilities
│   │   ├── networks.ts              # Network configurations
│   │   ├── gas-station.ts           # Gas price estimation
│   │   └── ...                      # Other utilities
│   ├── main.ts                      # CLI entry point
│   └── types.ts                     # TypeScript type definitions
├── tests/
│   ├── commands/
│   │   ├── token-registry/
│   │   │   └── mint.test.ts
│   │   └── w3c/
│   │       ├── did.test.ts
│   │       ├── key-pair.test.ts
│   │       └── credentialStatus/
│   │           ├── create.test.ts
│   │           └── update.test.ts
│   └── main.test.ts
├── package.json
└── README.md
```

## License

Apache-2.0
