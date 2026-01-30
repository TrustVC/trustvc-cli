import { input } from '@inquirer/prompts';
import { Wallet } from 'ethers';
import signale from 'signale';
import fs from 'fs';
import {
  highlight,
  isDirectoryValid,
  writeFile,
  progress as defaultProgress,
  promptOutputDirectory,
  promptWalletPassword,
  checkAndPromptOverwrite,
} from '../../utils';

export const command = 'encrypt';
export const describe = 'Encrypt a wallet using a private key';

export const handler = async () => {
  try {
    const answers = await promptQuestions();
    if (!answers) return;

    const { privateKey, walletPassword, walletPath } = answers;
    await encryptAndSaveWallet(privateKey, walletPassword, walletPath);
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
  }
};

export const promptQuestions = async () => {
  // Prompt for private key
  const privateKey = await input({
    message: 'Enter your private key (with or without 0x prefix):',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Private key is required';
      }
      // Remove 0x prefix if present for validation
      const cleanKey = value.startsWith('0x') ? value.slice(2) : value;
      if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
        return 'Invalid private key format. Must be 64 hexadecimal characters.';
      }
      return true;
    },
  });

  // Prompt for wallet password with confirmation
  const walletPassword = await promptWalletPassword();

  // Prompt for output directory or file path
  const walletPath = await promptOutputDirectory('encrypted wallet');

  // Normalize empty input or '.' to current directory
  const normalizedPath =
    !walletPath || walletPath.trim() === '' || walletPath === '.' ? '.' : walletPath;

  // Validate: must be either an existing directory or a path ending with .json
  let isDirectory = false;
  try {
    isDirectory = fs.lstatSync(normalizedPath).isDirectory();
  } catch (e) {
    // Path doesn't exist, check if it's a .json file path
  }

  const isJsonFilePath = normalizedPath.toLowerCase().endsWith('.json');

  if (!isDirectory && !isJsonFilePath) {
    throw new Error(
      `Invalid path: ${normalizedPath}. Please provide either a directory path or a file path ending with .json`,
    );
  }

  if (isDirectory && !isDirectoryValid(normalizedPath)) {
    throw new Error(`Invalid directory path provided: ${normalizedPath}`);
  }

  return { privateKey, walletPassword, walletPath: normalizedPath };
};

export const encryptAndSaveWallet = async (
  privateKey: string,
  walletPassword: string,
  walletPath: string,
) => {
  // Determine the final file path first
  let walletFilePath: string;
  const normalizedPath = !walletPath || walletPath.trim() === '' ? '.' : walletPath;

  // Check if path is a directory
  let isDirectory = false;
  try {
    isDirectory = fs.lstatSync(normalizedPath).isDirectory();
  } catch (e) {}

  if (isDirectory) {
    // If it's a directory (including current directory), create wallet.json inside it
    walletFilePath = normalizedPath === '.' ? 'wallet.json' : `${normalizedPath}/wallet.json`;
  } else if (normalizedPath.toLowerCase().endsWith('.json')) {
    // If it's a .json file path, use it directly
    walletFilePath = normalizedPath;
  } else {
    throw new Error(
      `Invalid path: ${normalizedPath}. Please provide either a directory path or a file path ending with .json`,
    );
  }

  // Check if file already exists and prompt for overwrite if needed
  await checkAndPromptOverwrite(walletFilePath);

  // Only proceed with wallet creation and encryption after confirmation
  signale.info('Creating wallet from private key...');

  // Create wallet from private key
  const wallet = new Wallet(privateKey);

  // Encrypt the wallet with the provided password
  const encryptedJson = await wallet.encrypt(walletPassword, defaultProgress('Encrypting Wallet'));

  // Write the encrypted wallet to file
  writeFile(walletFilePath, JSON.parse(encryptedJson), true);

  console.log(''); // blank line for spacing
  signale.success('Wallet encrypted and saved successfully');
  signale.info(`Saved to: ${walletFilePath}`);
  console.log(''); // blank line for spacing
  signale.info(`Wallet Address: ${highlight(wallet.address)}`);
  console.log(''); // blank line for spacing
  signale.warn('IMPORTANT: Store your password securely!');
  signale.warn('IMPORTANT: Never share this file or your private key publicly!');
  signale.warn(
    'IMPORTANT: If you lose your password, you will not be able to recover your wallet!',
  );

  return wallet;
};
