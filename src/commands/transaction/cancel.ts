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

export const builder = (yargs: Argv): Argv => yargs;

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

/** Collect all inputs via prompts */
export const promptForInputs = async (): Promise<TransactionCancelCommand> => {
  const txSpec = await promptTransactionSpec();
  const network = await promptNetworkSelection();
  const walletSelection = await promptWalletSelection();

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
      gasPrice,
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

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    await runCancelTransaction(answers);
  } catch (e) {
    error(getErrorMessage(e));
  }
};
