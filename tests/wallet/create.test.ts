import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAndSaveWallet } from '../../src/commands/wallet/create';
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
    writeFile: vi.fn((path: string, data: any) => {
      fs.writeFileSync(path, JSON.stringify(data, null, 2));
    }),
    progress: vi.fn(() => () => {}),
  };
});

// Note: This is a dummy password used only for testing mock wallet encryption/decryption.
const mockedPassword = 'password123';

describe('wallet/create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save the wallet into the provided path', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const walletPath = tmpDir.name;

    await generateAndSaveWallet(mockedPassword, walletPath);

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

    // Verify we can decrypt the wallet
    const decryptedWallet = await Wallet.fromEncryptedJson(walletAsString, mockedPassword);
    expect(decryptedWallet.address).toEqual(expect.any(String));
    expect(decryptedWallet.privateKey).toEqual(expect.any(String));

    // Cleanup
    tmpDir.removeCallback();
  }, 30000);

  it('should create a wallet with valid mnemonic phrase', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const walletPath = tmpDir.name;

    const wallet = await generateAndSaveWallet(mockedPassword, walletPath);

    expect(wallet.mnemonic).toBeDefined();
    expect(wallet.mnemonic?.phrase).toEqual(expect.any(String));
    expect(wallet.mnemonic?.phrase.split(' ')).toHaveLength(12);

    // Cleanup
    tmpDir.removeCallback();
  }, 30000);
});
