import { Argv } from 'yargs';
import { input, select } from '@inquirer/prompts';
import { error, info, success } from 'signale';
import { cancelTransaction } from '@trustvc/trustvc';
import {
  getWalletOrSigner,
  getErrorMessage,
  getEtherscanAddress,
  promptNetworkSelection,
  promptWalletSelection,
  supportedNetwork,
  withNetworkAndWalletSignerOption,
} from '../../utils';

export type TransactionCancelCommand = {
  network: string;
  nonce?: string;
  gasPrice?: string;
  transactionHash?: string;
  encryptedWalletPath?: string;
  key?: string;
  keyFile?: string;
  rpcUrl?: string;
};

export const command = 'cancel';

export const describe = 'Cancel a pending transaction on the blockchain';

export const builder = (yargs: Argv): Argv =>
  withNetworkAndWalletSignerOption(
    yargs
      .option('nonce', {
        description: 'Pending transaction nonce',
        type: 'string',
        implies: 'gas-price',
        conflicts: 'transaction-hash',
      })
      .option('gas-price', {
        description:
          'Gas price (wei) for the replacement transaction (must be higher than the pending tx)',
        type: 'string',
        implies: 'nonce',
        conflicts: 'transaction-hash',
      })
      .option('transaction-hash', {
        alias: 'th',
        description: 'Pending transaction hash (0x...)',
        type: 'string',
      })
      .option('wallet-path', {
        description: 'Alias for encrypted-wallet-path (path to wallet.json)',
        type: 'string',
      }),
  ).option('network', {
    choices: Object.keys(supportedNetwork),
    default: undefined,
    description: 'Ethereum network (prompted if not provided)',
  });

/** Prompt for how to specify the pending transaction and collect nonce/gas or hash */
async function promptTransactionSpec(): Promise<{
  nonce?: string;
  gasPrice?: string;
  transactionHash?: string;
}> {
  const method = await select({
    message: 'How do you want to specify the pending transaction?',
    choices: [
      {
        name: 'By transaction hash (recommended – gas price will be increased by 100% automatically)',
        value: 'hash',
        description: 'Enter the pending transaction hash (0x...)',
      },
      {
        name: 'By nonce and gas price',
        value: 'nonceGas',
        description: 'Enter the nonce and a higher gas price in wei',
      },
    ],
    default: 'hash',
  });

  if (method === 'hash') {
    const transactionHash = await input({
      message: 'Enter the pending transaction hash (0x...):',
      required: true,
      validate: (value: string) => {
        const v = value.trim();
        if (!v) return 'Transaction hash is required';
        if (!/^0x[a-fA-F0-9]{64}$/.test(v))
          return 'Invalid transaction hash (expected 0x followed by 64 hex characters)';
        return true;
      },
    });
    return { transactionHash: transactionHash.trim() };
  }

  const nonce = await input({
    message: 'Enter the pending transaction nonce:',
    required: true,
    validate: (value: string) => {
      const n = value.trim();
      if (!n) return 'Nonce is required';
      if (!/^\d+$/.test(n)) return 'Nonce must be a non-negative integer';
      return true;
    },
  });

  const gasPrice = await input({
    message:
      'Enter the gas price (wei) for the replacement transaction (must be higher than the pending transaction):',
    required: true,
    validate: (value: string) => {
      const v = value.trim();
      if (!v) return 'Gas price is required';
      if (!/^\d+$/.test(v)) return 'Gas price must be a non-negative integer (wei)';
      return true;
    },
  });

  return { nonce: nonce.trim(), gasPrice: gasPrice.trim() };
}

/** Collect inputs via prompts; only prompts for missing fields when partial is provided */
export const promptForInputs = async (
  partial?: Partial<TransactionCancelCommand>,
): Promise<TransactionCancelCommand> => {
  const hasTxSpec = !!partial?.transactionHash || (!!partial?.nonce && !!partial?.gasPrice);
  const txSpec = hasTxSpec
    ? {
        nonce: partial?.nonce,
        gasPrice: partial?.gasPrice,
        transactionHash: partial?.transactionHash,
      }
    : await promptTransactionSpec();
  const network =
    partial?.network && partial.network.length > 0
      ? partial.network
      : await promptNetworkSelection();
  const hasWallet = !!partial?.encryptedWalletPath || !!partial?.key || !!partial?.keyFile;
  const walletSelection = hasWallet
    ? {
        encryptedWalletPath: partial?.encryptedWalletPath,
        key: partial?.key,
        keyFile: partial?.keyFile,
      }
    : await promptWalletSelection();

  return {
    ...txSpec,
    network,
    ...walletSelection,
  };
};

/**
 * Run cancel transaction with pre-filled answers (no prompts). Used for scripting/tests.
 */
export const runCancelTransaction = async (
  answers: TransactionCancelCommand,
): Promise<string | undefined> => {
  const { network, nonce, gasPrice, transactionHash, encryptedWalletPath, key, keyFile, rpcUrl } =
    answers;

  if (transactionHash) {
    info('Fetching transaction to get nonce and gas price; replacement will use 2x gas price.');
  }

  const wallet = await getWalletOrSigner({
    network,
    encryptedWalletPath,
    key,
    keyFile,
    rpcUrl,
  });

  // Wallet from getWalletOrSigner satisfies CancelTransactionSigner (ethers v5/v6 compatible)
  const replacementHash = await cancelTransaction(
    wallet as Parameters<typeof cancelTransaction>[0],
    {
      nonce,
      gasPrice, // already a string (wei)
      transactionHash,
    },
  );

  success('Transaction has been cancelled');
  if (replacementHash) {
    info(`Replacement transaction hash: ${replacementHash}`);
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${replacementHash}`);
  }
  return replacementHash;
};

type RawCliArgs = TransactionCancelCommand & {
  // CLI flags as they come from yargs
  nonce?: string;
  'gas-price'?: string;
  'transaction-hash'?: string;
  'wallet-path'?: string;
};

/** Normalise yargs CLI arguments into a single internal shape. */
const normaliseCliArgs = (argv: RawCliArgs): TransactionCancelCommand => {
  const a = argv as Record<string, unknown>;

  const cliNonce: string | undefined = (argv.nonce ?? (a.nonce as string)) as string | undefined;
  const cliGasPrice = (a['gas-price'] ?? a.gasPrice) as string | undefined;
  const cliTxHash = (a['transaction-hash'] ?? a.transactionHash) as string | undefined;
  const cliEncryptedWalletPath = (a['encrypted-wallet-path'] ??
    a.encryptedWalletPath ??
    a['wallet-path'] ??
    a.walletPath) as string | undefined;

  return {
    network: (argv.network ?? a.network) as string,
    nonce: cliNonce,
    gasPrice: cliGasPrice,
    transactionHash: cliTxHash,
    encryptedWalletPath: cliEncryptedWalletPath,
    key: argv.key,
    keyFile: argv.keyFile,
    rpcUrl: argv.rpcUrl,
  };
};

/** Decide if we have enough input to run non-interactively (no prompts). */
const hasCompleteNonInteractiveInput = (base: TransactionCancelCommand): boolean => {
  const hasTxSpec = !!base.transactionHash || (!!base.nonce && !!base.gasPrice);
  const hasNetwork = typeof base.network === 'string' && base.network.length > 0;
  const hasWalletInput =
    !!base.encryptedWalletPath || !!base.key || !!base.keyFile || !!process.env.OA_PRIVATE_KEY;

  return hasTxSpec && hasNetwork && hasWalletInput;
};

/**
 * Prompt only for missing inputs, then merge them with any CLI-provided values.
 * CLI inputs always win over prompted values.
 */
const collectFinalAnswers = async (
  baseFromCli: TransactionCancelCommand,
): Promise<TransactionCancelCommand> => {
  const prompted = await promptForInputs(baseFromCli);

  return {
    ...prompted,
    ...baseFromCli,
    nonce: baseFromCli.nonce ?? prompted.nonce,
    gasPrice: baseFromCli.gasPrice ?? prompted.gasPrice,
    transactionHash: baseFromCli.transactionHash ?? prompted.transactionHash,
    network: baseFromCli.network ?? prompted.network,
    encryptedWalletPath: baseFromCli.encryptedWalletPath ?? prompted.encryptedWalletPath,
    key: baseFromCli.key ?? prompted.key,
    keyFile: baseFromCli.keyFile ?? prompted.keyFile,
    rpcUrl: baseFromCli.rpcUrl ?? prompted.rpcUrl,
  };
};

export const handler = async (argv: RawCliArgs): Promise<void> => {
  try {
    const baseFromCli = normaliseCliArgs(argv);

    if (hasCompleteNonInteractiveInput(baseFromCli)) {
      await runCancelTransaction(baseFromCli);
      return;
    }

    const finalAnswers = await collectFinalAnswers(baseFromCli);
    await runCancelTransaction(finalAnswers);
  } catch (e) {
    error(getErrorMessage(e));
  }
};
