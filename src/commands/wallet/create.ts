import { Wallet } from 'ethers';
import signale from 'signale';
import {
  isDirectoryValid,
  progress,
  writeFile,
  promptOutputDirectory,
  promptWalletPassword,
  checkAndPromptOverwrite,
  isDir,
} from '../../utils';

export const command = 'create';
export const describe = 'Create a new encrypted wallet file';

export const handler = async () => {
  try {
    const answers = await promptQuestions();
    if (!answers) return;

    const { walletPassword, walletPath } = answers;
    await generateAndSaveWallet(walletPassword, walletPath);
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
  }
};

export const promptQuestions = async () => {
  // Prompt for wallet password with confirmation
  const walletPassword = await promptWalletPassword();

  // Prompt for output directory or file path
  const walletPath = await promptOutputDirectory('encrypted wallet');

  // Normalize empty input or '.' to current directory
  const normalizedPath =
    !walletPath || walletPath.trim() === '' || walletPath === '.' ? '.' : walletPath;

  // Validate: must be either an existing directory or a path ending with .json
  const isJsonFilePath = normalizedPath.toLowerCase().endsWith('.json');

  if (!isDir(normalizedPath) && !isJsonFilePath) {
    throw new Error(
      `Invalid path: ${normalizedPath}. Please provide either a directory path or a file path ending with .json`,
    );
  }

  if (isDir(normalizedPath) && !isDirectoryValid(normalizedPath)) {
    throw new Error(`Invalid directory path provided: ${normalizedPath}`);
  }

  return { walletPassword, walletPath: normalizedPath };
};

export const generateAndSaveWallet = async (walletPassword: string, walletPath: string) => {
  // Determine the final file path first
  let walletFilePath: string;
  const normalizedPath = !walletPath || walletPath.trim() === '' ? '.' : walletPath;

  // Check if path is a directory
  if (isDir(normalizedPath)) {
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

  // Only proceed with wallet generation and encryption after confirmation
  signale.info('Generating new wallet...');

  // Create a random wallet
  const wallet = Wallet.createRandom();

  // Encrypt the wallet with the provided password
  const encryptedJson = await wallet.encrypt(walletPassword, progress('Encrypting wallet..'));

  // Write the encrypted wallet to file
  writeFile(walletFilePath, JSON.parse(encryptedJson), true);

  console.log(''); // blank line for spacing
  signale.success('Wallet created and encrypted successfully');
  signale.info(`Saved to: ${walletFilePath}`);
  console.log(''); // blank line for spacing
  signale.info(`Wallet Address: ${wallet.address}`);
  signale.info(`Mnemonic Phrase: ${wallet.mnemonic?.phrase || 'N/A'}`);
  console.log(''); // blank line for spacing
  signale.warn('IMPORTANT: Store your password and mnemonic phrase securely!');
  signale.warn('IMPORTANT: Never share this file or your mnemonic phrase publicly!');
  signale.warn(
    'IMPORTANT: If you lose your password, you will not be able to recover your wallet!',
  );

  return wallet;
};
