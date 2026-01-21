import { input, select, confirm } from '@inquirer/prompts';
import { info, error } from 'signale';
import { Argv } from 'yargs';
import {
  NetworkCmdName,
  supportedNetwork,
  getSupportedNetwork,
  SUPPORTED_CHAINS,
  CHAIN_ID,
} from './networks';
import { readDocumentFile } from './file-io';
import { getTokenRegistryAddress, getTokenId, getChainId } from '@trustvc/trustvc';
import fs from 'fs';
import { getTokenRegistryVersion } from '../commands/helpers';
import { getErrorMessage } from './index';
import { dryRunMode } from './dryRun';

export interface NetworkOption {
  network: string;
}

// it should be a union, because we expect one or the other key. However I couldn't find a clean way to handle this, with the rest of the code
export type PrivateKeyOption =
  | { key: string; keyFile?: never }
  | { key?: never; keyFile: string }
  | { key?: undefined; keyFile?: undefined };

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isPrivateKeyOption = (option: any): option is PrivateKeyOption => {
  return typeof option?.key === 'string' || typeof option?.keyFile === 'string';
};

export type AwsKmsSignerOption = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  kmsKeyId: string;
  sessionToken: string;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isAwsKmsSignerOption = (option: any): option is AwsKmsSignerOption => {
  return typeof option?.region === 'string' && typeof option?.kmsKeyId === 'string';
};

export type WalletOption = {
  encryptedWalletPath: string;
};
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isWalletOption = (option: any): option is WalletOption => {
  return typeof option?.encryptedWalletPath === 'string';
};

export type RpcUrlOption = {
  rpcUrl: string;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isRpcUrlOption = (option: any): option is RpcUrlOption => {
  return typeof option?.rpcUrl === 'string';
};

export type WalletOrSignerOption =
  | Partial<PrivateKeyOption>
  | Partial<AwsKmsSignerOption>
  | Partial<WalletOption>;

export interface GasPriceScale {
  maxPriorityFeePerGasScale: number;
}
export type NetworkAndWalletSignerOption = NetworkOption &
  (Partial<WalletOption> | Partial<PrivateKeyOption>);

export const withNetworkOption = (yargs: Argv): Argv =>
  yargs.option('network', {
    alias: 'n',
    choices: Object.keys(supportedNetwork),
    default: 'mainnet',
    description: 'Ethereum network to deploy to',
  });
export const withGasPriceOption = (yargs: Argv): Argv =>
  yargs
    .option('priority', {
      alias: 'maxPriorityFeePerGasScale',
      type: 'number',
      default: 1,
      demandOption: false,
      description:
        'Scale for estimated priority fees (maxPriorityFeePerGasScale * estimatedPriorityFeePerGas)',
    })
    .option('dry-run', {
      alias: 'dr',
      type: 'boolean',
      default: false,
      description: 'Provide estimated MaxFeePerGas and PriorityFeePerGas',
    });

export const withPrivateKeyOption = (yargs: Argv): Argv =>
  yargs
    .option('key', {
      alias: 'k',
      type: 'string',
      description: 'Private key of owner account',
    })
    .option('key-file', {
      alias: 'f',
      type: 'string',
      description: 'Path to file containing private key of owner account',
    });

export const withWalletOption = (yargs: Argv): Argv =>
  yargs.option('encrypted-wallet-path', {
    type: 'string',
    description: 'Path to wallet.json file',
    normalize: true,
  });

export const withAwsKmsSignerOption = (yargs: Argv): Argv =>
  yargs
    .option('access-key-id', {
      type: 'string',
      description: 'AWS access key id. Example: AKIAIOSFODNN7EXAMPLE',
    })
    .option('secret-access-key', {
      type: 'string',
      description: 'AWS secret access key. Example: Z8ll+k0CBew8bqqily568Dukv4yaWYOFSOnfui/T',
    })
    .option('region', {
      type: 'string',
      description: 'AWS region. Example: us-east-2',
    })
    .option('session-token', {
      type: 'string',
      description:
        'AWS Session token. Example: IQoJb3JpZ2luX2VjEDsaDmFwLXNvdXRoZWFzdC0xIkcwRQIgR7ap3CSpkQ0U1IA1KYebxXB5pmpvHd59pTZRsmXzC5MCIQCij0GELbTj8R30Wcho1NgZq3q/dSLoFm2gD9WOFRxamiqeAggkEAMaDDczMzQ4NzYyMjk4MiIMiXeHIetiIMVm85SUKvsBTlIStOhlYNlNJmQHeiumoWXztNuksDK9/pEpam5ZALdi9TI6PJkSuAq+vd7c+ecMC7gN0Fs8sCkM5AjgG7x/WE+81tcOBq/oNF71drfViT5w7/mcBoElSEVUUjQx1oKWfcBLWD/tXu0593hPOi2dHdoG83/6KEgyaNrkpWQdTLK5zUTmtDYLsyoKwZEbGEulUK11WCfbCctJWtlk9RXHdDgbgDP2PzJpeuET4CV21GMX1jsnMeeRNhFX5dqy3+FMIjsAFiWGuE0Q7Fnyjrb/YQVG5BL3LqvYdJGI4HUT/fKtQrWS+skxCm1divsLAhl9+Z0GQ8WDgR3W4akwjt64oQY6nQFjnkWLSBf+OXpkWi1IzPPAqx09srAJiNmz8J+7kdHSLjr5IrKh1hzimxtVNkPX+22ahdmE5m4o5oJm1lgZSLmfYdmvifK76E8y247deFRl4Q0Z+75PDjriw1i4QJcg+USGcFJN6O/dOw5S4if/eYbPaoRBLQOAMYBYjr4aZ3TuMmMHNgMRLBKtQ8fVPpslU2L6XOPRkVR1RejSbII5',
    })
    .option('kms-key-id', {
      type: 'string',
      description:
        'AWS KMS key id. Example: arn:aws:kms:us-west-2:111122223333:key/1234abcd-12ab-34cd-56ef-1234567890ab',
    });

export const withRpcUrlOption = (yargs: Argv): Argv =>
  yargs.option('rpc-url', {
    type: 'string',
    description:
      'Custom RPC URL to connect to. Example: https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
  });

export const withNetworkAndWalletSignerOption = (yargs: Argv): Argv =>
  withNetworkOption(
    withRpcUrlOption(withAwsKmsSignerOption(withWalletOption(withPrivateKeyOption(yargs)))),
  );

/**
 * Prompts for network selection with all available networks.
 * @returns The selected network as NetworkCmdName
 */
export const promptNetworkSelection = async (): Promise<string> => {
  const network = await select({
    message: 'Select the network:',
    choices: [
      { name: 'Local', value: NetworkCmdName.Local },
      { name: 'Ethereum Mainnet', value: NetworkCmdName.Mainnet },
      { name: 'Sepolia Testnet', value: NetworkCmdName.Sepolia },
      { name: 'Polygon Mainnet', value: NetworkCmdName.Matic },
      { name: 'Polygon Amoy Testnet', value: NetworkCmdName.Amoy },
      { name: 'XDC Network', value: NetworkCmdName.XDC },
      { name: 'XDC Apothem Testnet', value: NetworkCmdName.XDCApothem },
      { name: 'Stability Testnet', value: NetworkCmdName.StabilityTestnet },
      { name: 'Stability Mainnet', value: NetworkCmdName.Stability },
      { name: 'Astron', value: NetworkCmdName.Astron },
      { name: 'Astron Testnet', value: NetworkCmdName.AstronTestnet },
    ],
    default: NetworkCmdName.Sepolia,
  });

  return network;
};

/**
 * Prompts for wallet/private key selection and returns the selected credentials.
 * @returns An object containing encryptedWalletPath, key, or keyFile based on user selection
 */
export const promptWalletSelection = async (): Promise<{
  encryptedWalletPath?: string;
  key?: string;
  keyFile?: string;
}> => {
  const walletOption = await select({
    message: 'Select wallet/private key option:',
    choices: [
      {
        name: 'Encrypted wallet file (recommended)',
        value: 'encryptedWallet',
        description: 'Path to an encrypted wallet JSON file',
      },
      {
        name: 'Environment variable (OA_PRIVATE_KEY)',
        value: 'envVariable',
        description: 'Use private key from OA_PRIVATE_KEY environment variable',
      },
      {
        name: 'Private key file',
        value: 'keyFile',
        description: 'Path to a file containing the private key',
      },
      {
        name: 'Private key directly',
        value: 'keyDirect',
        description: 'Provide private key directly (will be stored in bash history)',
      },
    ],
    default: 'encryptedWallet',
  });

  let encryptedWalletPath: string | undefined;
  let key: string | undefined;
  let keyFile: string | undefined;

  if (walletOption === 'encryptedWallet') {
    encryptedWalletPath = await input({
      message: 'Enter the path to your encrypted wallet JSON file:',
      default: './wallet.json',
      required: true,
    });
  } else if (walletOption === 'envVariable') {
    if (!process.env.OA_PRIVATE_KEY) {
      throw new Error(
        'OA_PRIVATE_KEY environment variable is not set. Please set it or choose another option.',
      );
    }
    info('Using private key from OA_PRIVATE_KEY environment variable');
    // Return empty object - the key will be picked up from environment variable
  } else if (walletOption === 'keyFile') {
    keyFile = await input({
      message: 'Enter the path to your private key file:',
      required: true,
    });
  } else if (walletOption === 'keyDirect') {
    key = await input({
      message: 'Enter your private key:',
      required: true,
    });
  }

  return {
    encryptedWalletPath,
    key,
    keyFile,
  };
};

/**
 * Prompts for optional remark and encryption key.
 * If a remark is provided, also prompts for the document ID to use as encryption key.
 * @returns An object containing the remark and encryptionKey (both optional)
 */
export const promptRemarkAndEncryptionKey = async (): Promise<{
  remark?: string;
  encryptionKey?: string;
}> => {
  // Optional: Remark
  const remark = await input({
    message: 'Enter a remark (optional):',
    required: false,
  });

  // Optional: Encryption Key (only if remark is provided)
  let encryptionKey: string | undefined;
  if (remark && remark.trim() !== '') {
    info(
      'This document ID will be used to encrypt the Document. You can find it inside your document for example: "urn:uuid:019b9ce6-5048-7669-b1bf-e15d1f085692"',
    );
    encryptionKey = await input({
      message: 'Enter the document Id :',
      required: false,
    });
  }

  return {
    remark: remark || undefined,
    encryptionKey: encryptionKey || undefined,
  };
};

/**
 * Maps a chainId to a network name
 * @param chainId - The chain ID from the document
 * @returns The network name
 */
export const getNetworkFromChainId = (chainId: number): string => {
  const chainIdMap: Record<number, string> = {
    1: 'mainnet',
    11155111: 'sepolia',
    137: 'matic',
    80002: 'amoy',
    101010: 'stability',
    20180427: 'stabilitytestnet',
    1338: 'astron',
    21002: 'astrontestnet',
    50: 'xdc',
    51: 'xdcapothem',
    1337: 'local',
  };

  const network = chainIdMap[chainId];
  if (!network) {
    throw new Error(
      `Unsupported chainId: ${chainId}. Please add mapping or select network manually.`,
    );
  }

  return network;
};

/**
 * Prompts for document file path and reads the document.
 * @returns The parsed document object
 */
export const promptAndReadDocument = async (): Promise<any> => {
  // Document file path
  const documentPath = await input({
    message: 'Enter the path to the TT/JSON document file:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Document file path is required';
      }
      if (!fs.existsSync(value)) {
        return 'File does not exist';
      }
      if (!/\.(tt|json|jsonld)$/i.test(value)) {
        return 'File must be a .tt, .json, or .jsonld file';
      }
      return true;
    },
  });

  // Read and parse the document
  let document: any;
  try {
    document = readDocumentFile(documentPath);
  } catch (err) {
    throw new Error(
      `Failed to read document file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return document;
};

/**
 * Prompts for document file path, extracts and displays document information.
 * @returns An object containing the document, tokenRegistry, tokenId, network, documentId, and registryVersion
 */
export const extractDocumentInfo = async (
  document: any,
): Promise<{
  document: any;
  tokenRegistry: string;
  tokenId: string;
  network: string;
  documentId: string;
  registryVersion: string;
}> => {
  // Extract information using trustvc utility functions
  let tokenRegistry: string | undefined;
  let tokenId: string | undefined;
  let chainId: CHAIN_ID | undefined;

  try {
    tokenRegistry = getTokenRegistryAddress(document);
    tokenId = getTokenId(document);
    chainId = getChainId(document);
  } catch (err) {
    throw new Error(
      `Failed to extract document information: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Validate extracted values
  if (!tokenRegistry) {
    throw new Error('Document does not contain a valid token registry address');
  }

  if (!tokenId) {
    throw new Error('Document does not contain a valid token ID');
  }

  if (!chainId) {
    throw new Error('Document does not contain a valid chain ID');
  }

  // Map chainId to network name
  const network = SUPPORTED_CHAINS[chainId].name;

  // Get provider to check token registry version (no wallet needed)
  const provider = getSupportedNetwork(network).provider();
  const registryVersion = await getTokenRegistryVersion(tokenRegistry, provider);

  // Extract document ID
  const documentId = document.id || 'N/A';

  info(`Extracted from document:`);
  info(`  Network: ${network} (Chain ID: ${chainId})`);
  info(`  Token Registry (Version ${registryVersion.toUpperCase()}): ${tokenRegistry}`);
  info(`  Token ID: ${tokenId}`);
  info(`  Document ID: ${documentId}`);

  return {
    document,
    tokenRegistry,
    tokenId,
    network,
    documentId,
    registryVersion,
  };
};

/**
 * Prompts for an optional remark based on token registry version.
 * Only prompts if the registry version is V5.
 * @param registryVersion - The token registry version ('v4' or 'v5')
 * @returns The remark string or undefined
 */
export const promptRemark = async (registryVersion: string): Promise<string | undefined> => {
  if (registryVersion === 'v5') {
    const remarkInput = await input({
      message: 'Enter a remark (optional, press Enter to skip):',
      required: false,
    });

    // Show encryption info if remark was entered
    if (remarkInput && remarkInput.trim() !== '') {
      info('ℹ️  The remark will be encrypted with the document ID as the encryption key.');
    }

    return remarkInput || undefined;
  } else {
    info('Remark is not supported for V4 token registries. Skipping remark input.');
    return undefined;
  }
};

/**
 * Prompts for an Ethereum address with validation.
 * @param role - The role of the address (e.g., 'beneficiary', 'holder', 'new holder')
 * @param description - Optional additional description (e.g., 'initial recipient', 'initial holder')
 * @returns The validated Ethereum address
 */
export const promptAddress = async (role: string, description?: string): Promise<string> => {
  const roleCapitalized = role.charAt(0).toUpperCase() + role.slice(1);
  const messageText = description
    ? `Enter the address of the ${role} (${description}):`
    : `Enter the address of the ${role}:`;

  const address = await input({
    message: messageText,
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return `${roleCapitalized} address is required`;
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
        return 'Invalid Ethereum address format';
      }
      return true;
    },
  });

  return address;
};

/**
 * Checks if the network requires automatic dry run (Ethereum and Polygon networks)
 */
export const shouldRunDryRun = (network: string): boolean => {
  const dryRunNetworks = [
    NetworkCmdName.Mainnet, // Ethereum Mainnet
    NetworkCmdName.Sepolia, // Ethereum Sepolia Testnet
    NetworkCmdName.Matic, // Polygon Mainnet
    NetworkCmdName.Amoy, // Polygon Amoy Testnet
  ];
  return dryRunNetworks.includes(network as NetworkCmdName);
};

/**
 * Performs automatic dry run for specified networks with gas estimation and user confirmation
 * Uses the existing dryRunMode function for comprehensive display
 */
export const performDryRunWithConfirmation = async ({
  network,
  getTransactionCallback,
}: {
  network: string;
  getTransactionCallback: () => Promise<any>;
}): Promise<boolean> => {
  if (!shouldRunDryRun(network)) {
    return true; // Proceed without dry run for other networks
  }

  try {
    // Get the populated transaction - dryRunMode will estimate gas automatically
    const transaction = await getTransactionCallback();

    // Use the existing dryRunMode function for comprehensive display
    // It will automatically estimate gas from the transaction
    await dryRunMode({
      network,
      transaction,
    });

    // Ask user to proceed
    const proceed = await confirm({
      message: '\nDo you want to proceed with the actual transaction?',
      default: true,
    });

    if (!proceed) {
      info('Transaction cancelled by user.');
      return false;
    }

    info('\n✅ Proceeding with transaction...');
    return true;
  } catch (estimateError) {
    error(`Gas estimation failed: ${getErrorMessage(estimateError)}`);
    const proceedAnyway = await confirm({
      message: 'Gas estimation failed. Do you want to proceed anyway?',
      default: false,
    });

    if (!proceedAnyway) {
      info('Transaction cancelled by user.');
      return false;
    }

    return true;
  }
};
