# TrustVC CLI

A command-line interface tool for working with Decentralized Identifiers (DIDs) and cryptographic key pairs using modern cryptosuites.

## Features

- ✅ **Modern Cryptosuites**: Full support for ECDSA-SD-2023 and BBS-2023
- ✅ **Key Pair Generation**: Generate cryptographic key pairs with Multikey format
- ✅ **DID Management**: Create and manage did:web identifiers
- ✅ **W3C Standards**: Compliant with latest W3C DID specifications

## Powered By

This CLI leverages the TrustVC package:

- [`@trustvc/trustvc`](https://github.com/TrustVC/trustvc) - Key pair and DID generation

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Commands](#commands)
  - [`trustvc key-pair`](#trustvc-key-pair)
  - [`trustvc did`](#trustvc-did)
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
trustvc key-pair

# Create a DID from the key pair
trustvc did
```

## How It Works

- **Generating Key Pairs**: The CLI uses the `generateKeyPair` function from `@trustvc/trustvc` to generate cryptographic key pairs. These key pairs support modern cryptosuites (ECDSA-SD-2023, BBS-2023) and use the Multikey format for compatibility with W3C standards.

- **Generating Well-Known DID**: The CLI uses the `issueDID` function from `@trustvc/trustvc` to generate a did:web identifier. This allows users to self-host their DID as a unique identifier in decentralized systems.

## Commands

### `trustvc key-pair`

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
trustvc key-pair
```

### `trustvc did`

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
trustvc did
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
│   │   ├── did.ts          # DID generation command
│   │   └── key-pair.ts     # Key pair generation command
│   ├── main.ts             # CLI entry point
│   ├── types.ts            # TypeScript type definitions
│   └── utils.ts            # Utility functions
├── tests/
│   ├── commands/
│   │   ├── did.test.ts
│   │   └── key-pair.test.ts
│   └── main.test.ts
├── package.json
└── README.md
```

## License

Apache-2.0
