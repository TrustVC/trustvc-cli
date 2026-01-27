import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptAndSaveWallet } from '../../src/commands/wallet/encrypt';
import tmp from 'tmp';
import fs from 'fs';
import { Wallet } from 'ethers';

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

vi.mock('../../src/utils', async (importOriginal) => {
  const originalUtils = await importOriginal<typeof import('../../src/utils')>();
  return {
    ...originalUtils,
    writeFile: vi.fn((path: string, data: any, silent?: boolean) => {
      fs.writeFileSync(path, JSON.stringify(data, null, 2));
    }),
    highlight: vi.fn((text: string) => text),
    progress: vi.fn(() => () => {}),
  };
});

// Note: This is a dummy password used only for testing mock wallet encryption/decryption.
const mockedPassword = 'password123';

// Note: Dummy test wallets — private keys for local development and CI/CD only.
// These wallets are not for production and hold no funds or value on any network.
const privateKey = '0xcd27dc84c82c5814e7edac518edd5f263e7db7f25adb7a1afe13996a95583cf2';

describe('wallet/encrypt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should encrypt the wallet when the private key is provided', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const walletPath = tmpDir.name;

    await encryptAndSaveWallet(privateKey, mockedPassword, walletPath);

    const walletFilePath = `${walletPath}/wallet.json`;
    expect(fs.existsSync(walletFilePath)).toBe(true);

    const walletAsString = fs.readFileSync(walletFilePath, 'utf-8');
    const walletJson = JSON.parse(walletAsString);

    // Verify the wallet JSON has the expected structure
    expect(walletJson).toHaveProperty('address');
    expect(walletJson).toHaveProperty('id');
    expect(walletJson).toHaveProperty('version');
    expect(walletJson).toHaveProperty('Crypto');
    expect(walletJson.Crypto).toHaveProperty('cipher', 'aes-128-ctr');
    expect(walletJson.Crypto).toHaveProperty('kdf', 'scrypt');

    // Verify we can decrypt the wallet and it matches the original private key
    const decryptedWallet = await Wallet.fromEncryptedJson(walletAsString, mockedPassword);
    expect(decryptedWallet.address).toBe('0xB26B4941941C51a4885E5B7D3A1B861E54405f90');
    expect(decryptedWallet.privateKey).toBe(privateKey);

    // Cleanup
    tmpDir.removeCallback();
  }, 30000);

  it('should handle private key without 0x prefix', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const walletPath = tmpDir.name;
    const privateKeyWithoutPrefix = privateKey.slice(2);

    await encryptAndSaveWallet(privateKeyWithoutPrefix, mockedPassword, walletPath);

    const walletFilePath = `${walletPath}/wallet.json`;
    expect(fs.existsSync(walletFilePath)).toBe(true);

    const walletAsString = fs.readFileSync(walletFilePath, 'utf-8');
    const decryptedWallet = await Wallet.fromEncryptedJson(walletAsString, mockedPassword);
    expect(decryptedWallet.address).toBe('0xB26B4941941C51a4885E5B7D3A1B861E54405f90');

    // Cleanup
    tmpDir.removeCallback();
  }, 30000);
});
