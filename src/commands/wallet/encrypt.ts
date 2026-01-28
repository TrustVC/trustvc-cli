import { input } from '@inquirer/prompts';
import { Wallet } from 'ethers';
import signale from 'signale';
import {
  highlight,
  isDirectoryValid,
  writeFile,
  progress as defaultProgress,
  promptOutputDirectory,
  promptWalletPassword,
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

  // Prompt for output directory
  const walletPath = await promptOutputDirectory('encrypted wallet');

  if (!isDirectoryValid(walletPath)) {
    throw new Error(`Invalid directory path provided: ${walletPath}`);
  }

  return { privateKey, walletPassword, walletPath };
};

export const encryptAndSaveWallet = async (
  privateKey: string,
  walletPassword: string,
  walletPath: string,
) => {
  signale.info('Creating wallet from private key...');

  // Create wallet from private key
  const wallet = new Wallet(privateKey);

  signale.info('Encrypting wallet...');

  // Encrypt the wallet with the provided password
  const encryptedJson = await wallet.encrypt(walletPassword, defaultProgress('Encrypting Wallet'));

  const walletFilePath = `${walletPath}/wallet.json`;

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
