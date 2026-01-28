import { Wallet } from 'ethers';
import signale from 'signale';
import {
  isDirectoryValid,
  progress,
  writeFile,
  promptOutputDirectory,
  promptWalletPassword,
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

  // Prompt for output directory
  const walletPath = await promptOutputDirectory('encrypted wallet');

  if (!isDirectoryValid(walletPath)) {
    throw new Error(`Invalid directory path provided: ${walletPath}`);
  }

  return { walletPassword, walletPath };
};

export const generateAndSaveWallet = async (walletPassword: string, walletPath: string) => {
  signale.info('Generating new wallet...');

  // Create a random wallet
  const wallet = Wallet.createRandom();

  signale.info('Encrypting wallet...');

  // Encrypt the wallet with the provided password
  const encryptedJson = await wallet.encrypt(walletPassword, progress('Encrypting wallet..'));

  const walletFilePath = `${walletPath}/wallet.json`;

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
