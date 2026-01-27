import { input, password, confirm } from '@inquirer/prompts';
import { Wallet, HDNodeWallet } from 'ethers';
import signale from 'signale';
import { getWalletOrSigner } from '../../utils/wallet';
import { highlight } from '../../utils';

export const command = 'decrypt';
export const describe = 'Decrypt an encrypted wallet file and display private key';

export const handler = async () => {
  try {
    const answers = await promptQuestions();
    if (!answers) return;

    const { walletPath, walletPassword } = answers;
    await decryptAndDisplayWallet(walletPath, walletPassword);
  } catch (err: unknown) {
    signale.error(err instanceof Error ? err.message : String(err));
  }
};

export const promptQuestions = async () => {
  // Prompt for encrypted wallet file path
  const walletPath = await input({
    message: 'Enter the path to your encrypted wallet JSON file:',
    default: './wallet.json',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Wallet file path is required';
      }
      return true;
    },
  });

  // Prompt for wallet password
  const walletPassword = await password({
    message: 'Enter your wallet password:',
    mask: '*',
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Password is required';
      }
      return true;
    },
  });

  // Security confirmation
  signale.warn('⚠️  You are about to reveal the private key of your wallet.');
  const consent = await confirm({
    message: 'Do you understand the risks and want to proceed?',
    default: false,
  });

  if (!consent) {
    signale.info('Operation cancelled by user.');
    return null;
  }

  return { walletPath, walletPassword };
};

export const decryptAndDisplayWallet = async (walletPath: string, walletPassword: string) => {
  signale.info('Decrypting wallet...');

  // Use getWalletOrSigner with the provided password
  let wallet: Wallet | HDNodeWallet;
  try {
    wallet = (await getWalletOrSigner({
      encryptedWalletPath: walletPath,
      password: walletPassword,
    })) as Wallet | HDNodeWallet;
  } catch (err) {
    throw new Error('Failed to decrypt wallet. Please check your password and try again.');
  }

  console.log(''); // blank line for spacing
  signale.info(`Wallet Address: ${highlight(wallet.address)}`);
  signale.info(`Private Key: ${highlight(wallet.privateKey)}`);
  if ('mnemonic' in wallet && wallet.mnemonic) {
    signale.info(`Mnemonic Phrase: ${highlight(wallet.mnemonic.phrase)}`);
  }
  console.log(''); // blank line for spacing
  signale.warn('IMPORTANT: Never share your private key or mnemonic phrase with anyone!');
  signale.warn(
    'IMPORTANT: Store this information securely and delete it from your terminal history!',
  );

  return wallet;
};
