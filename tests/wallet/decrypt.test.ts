import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptAndDisplayWallet } from '../../src/commands/wallet/decrypt';
import tmp from 'tmp';
import fs from 'fs';
import { Wallet, HDNodeWallet } from 'ethers';

vi.mock('signale', async (importOriginal) => {
  const originalSignale = await importOriginal<typeof import('signale')>();
  return {
    ...originalSignale,
    default: {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    Signale: class MockSignale {
      await = vi.fn();
      success = vi.fn();
      error = vi.fn();
      info = vi.fn();
      warn = vi.fn();
      constructor() {}
    },
  };
});

vi.mock('../../src/utils/wallet', () => ({
  getWalletOrSigner: vi.fn(),
}));

vi.mock('../../src/utils', async (importOriginal) => {
  const originalUtils = await importOriginal<typeof import('../../src/utils')>();
  return {
    ...originalUtils,
    readFile: vi.fn(),
    highlight: vi.fn((text: string) => text),
  };
});

// Note: This is a dummy password used only for testing mock wallet encryption/decryption.
const mockedPassword = 'password123';

// Note: Dummy test wallets — private keys for local development and CI/CD only.
// These wallets are not for production and hold no funds or value on any network.
const privateKey = '0xcd27dc84c82c5814e7edac518edd5f263e7db7f25adb7a1afe13996a95583cf2';

describe('wallet/decrypt', () => {
  let encryptedWalletJson: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create an encrypted wallet for testing
    const wallet = new Wallet(privateKey);
    encryptedWalletJson = await wallet.encrypt(mockedPassword);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should decrypt the wallet and display wallet information', async () => {
    const tmpFile = tmp.fileSync({ postfix: '.json' });
    fs.writeFileSync(tmpFile.name, encryptedWalletJson);

    const utils = await import('../../src/utils');
    const walletUtils = await import('../../src/utils/wallet');

    // Mock readFile to return the encrypted wallet
    (utils.readFile as any).mockResolvedValue(encryptedWalletJson);

    // Mock getWalletOrSigner to return the decrypted wallet
    const wallet = await Wallet.fromEncryptedJson(encryptedWalletJson, mockedPassword);
    (walletUtils.getWalletOrSigner as any).mockResolvedValue(wallet);

    const result = await decryptAndDisplayWallet(tmpFile.name, mockedPassword);

    expect(result.address).toBe('0xB26B4941941C51a4885E5B7D3A1B861E54405f90');
    expect(result.privateKey).toBe(privateKey);
    expect(walletUtils.getWalletOrSigner).toHaveBeenCalledWith({
      encryptedWalletPath: tmpFile.name,
      password: mockedPassword,
    });

    // Cleanup
    tmpFile.removeCallback();
  }, 30000);

  it('should throw error when password is incorrect', async () => {
    const tmpFile = tmp.fileSync({ postfix: '.json' });
    fs.writeFileSync(tmpFile.name, encryptedWalletJson);

    const utils = await import('../../src/utils');
    const walletUtils = await import('../../src/utils/wallet');

    (utils.readFile as any).mockResolvedValue(encryptedWalletJson);
    (walletUtils.getWalletOrSigner as any).mockRejectedValue(new Error('incorrect password'));

    await expect(decryptAndDisplayWallet(tmpFile.name, 'wrongpassword')).rejects.toThrow(
      'Failed to decrypt wallet. Please check your password and try again.',
    );

    // Cleanup
    tmpFile.removeCallback();
  }, 30000);

  it('should handle wallet with mnemonic phrase', async () => {
    // Create a wallet with mnemonic
    const walletWithMnemonic = Wallet.createRandom();
    const encryptedWithMnemonic = await walletWithMnemonic.encrypt(mockedPassword);

    const tmpFile = tmp.fileSync({ postfix: '.json' });
    fs.writeFileSync(tmpFile.name, encryptedWithMnemonic);

    const utils = await import('../../src/utils');
    const walletUtils = await import('../../src/utils/wallet');

    (utils.readFile as any).mockResolvedValue(encryptedWithMnemonic);

    const decryptedWallet = await Wallet.fromEncryptedJson(encryptedWithMnemonic, mockedPassword);
    (walletUtils.getWalletOrSigner as any).mockResolvedValue(decryptedWallet);

    const result = await decryptAndDisplayWallet(tmpFile.name, mockedPassword);

    expect(result.address).toBe(walletWithMnemonic.address);
    expect(result).toBeInstanceOf(HDNodeWallet);
    if ('mnemonic' in result && result.mnemonic) {
      expect(result.mnemonic.phrase).toEqual(expect.any(String));
    }

    // Cleanup
    tmpFile.removeCallback();
  }, 30000);
});
