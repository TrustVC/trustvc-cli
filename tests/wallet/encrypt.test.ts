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
    writeFile: vi.fn((path: string, data: any) => {
      const dir = require('path').dirname(path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(path, JSON.stringify(data, null, 2));
    }),
    highlight: vi.fn((text: string) => text),
    progress: vi.fn(() => () => {}),
    checkAndPromptOverwrite: vi.fn(),
  };
});

vi.mock('@inquirer/prompts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@inquirer/prompts')>();
  return {
    ...original,
    confirm: vi.fn(),
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

  it('should save the wallet with custom filename when file path is provided', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const customFilePath = `${tmpDir.name}/my-encrypted-wallet.json`;

    await encryptAndSaveWallet(privateKey, mockedPassword, customFilePath);

    expect(fs.existsSync(customFilePath)).toBe(true);

    const walletAsString = fs.readFileSync(customFilePath, 'utf-8');
    const walletJson = JSON.parse(walletAsString);

    // Verify the wallet JSON has the expected structure
    expect(walletJson).toHaveProperty('address');
    expect(walletJson).toHaveProperty('id');
    expect(walletJson).toHaveProperty('version');
    expect(walletJson).toHaveProperty('Crypto');

    // Verify we can decrypt the wallet
    const decryptedWallet = await Wallet.fromEncryptedJson(walletAsString, mockedPassword);
    expect(decryptedWallet.privateKey).toBe(privateKey);

    // Cleanup
    tmpDir.removeCallback();
  }, 30000);

  it('should create parent directories when file path with non-existent directories is provided', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const nestedFilePath = `${tmpDir.name}/nested/dir/encrypted-wallet.json`;

    await encryptAndSaveWallet(privateKey, mockedPassword, nestedFilePath);

    expect(fs.existsSync(nestedFilePath)).toBe(true);

    const walletAsString = fs.readFileSync(nestedFilePath, 'utf-8');
    const walletJson = JSON.parse(walletAsString);

    // Verify the wallet JSON has the expected structure
    expect(walletJson).toHaveProperty('address');

    // Verify we can decrypt the wallet
    const decryptedWallet = await Wallet.fromEncryptedJson(walletAsString, mockedPassword);
    expect(decryptedWallet.privateKey).toBe(privateKey);

    // Cleanup
    tmpDir.removeCallback();
  }, 30000);

  it('should create wallet.json in current directory when "." is provided', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });

    // Test with '.' which should create wallet.json in the current directory
    await encryptAndSaveWallet(privateKey, mockedPassword, '.');

    // The file should be created as 'wallet.json' in the current working directory
    const walletFilePath = 'wallet.json';
    expect(fs.existsSync(walletFilePath)).toBe(true);

    const walletAsString = fs.readFileSync(walletFilePath, 'utf-8');
    const walletJson = JSON.parse(walletAsString);

    // Verify the wallet JSON has the expected structure
    expect(walletJson).toHaveProperty('address');

    // Verify we can decrypt the wallet
    const decryptedWallet = await Wallet.fromEncryptedJson(walletAsString, mockedPassword);
    expect(decryptedWallet.privateKey).toBe(privateKey);

    // Cleanup - delete the created wallet.json file
    if (fs.existsSync(walletFilePath)) {
      fs.unlinkSync(walletFilePath);
    }
    tmpDir.removeCallback();
  }, 30000);

  it('should prompt for overwrite when file already exists with wallet data', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const walletFilePath = `${tmpDir.name}/existing-wallet.json`;

    // Create an existing wallet file
    const existingWallet = {
      address: '0x1234567890123456789012345678901234567890',
      id: 'test-id',
      version: 3,
      Crypto: {
        cipher: 'aes-128-ctr',
        cipherparams: { iv: 'test-iv' },
        ciphertext: 'test-ciphertext',
        kdf: 'scrypt',
        kdfparams: { salt: 'test-salt', n: 131072, dklen: 32, p: 1, r: 8 },
        mac: 'test-mac',
      },
    };
    fs.writeFileSync(walletFilePath, JSON.stringify(existingWallet, null, 2));

    // Mock checkAndPromptOverwrite to simulate user declining
    const { checkAndPromptOverwrite } = await import('../../src/utils');
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.mocked(checkAndPromptOverwrite).mockImplementationOnce(async () => {
      process.exit(0);
    });

    await encryptAndSaveWallet(privateKey, mockedPassword, walletFilePath);

    // Verify checkAndPromptOverwrite was called
    expect(checkAndPromptOverwrite).toHaveBeenCalledWith(walletFilePath);

    // Verify process.exit was called
    expect(mockExit).toHaveBeenCalledWith(0);

    // Cleanup
    mockExit.mockRestore();
    if (fs.existsSync(walletFilePath)) {
      fs.unlinkSync(walletFilePath);
    }
    tmpDir.removeCallback();
  }, 30000);

  it('should prompt for overwrite when directory has existing wallet.json', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const walletFilePath = `${tmpDir.name}/wallet.json`;

    // Create an existing wallet.json in the directory
    const existingWallet = {
      address: '0x9876543210987654321098765432109876543210',
      id: 'test-id-2',
      version: 3,
      Crypto: {
        cipher: 'aes-128-ctr',
        cipherparams: { iv: 'test-iv-2' },
        ciphertext: 'test-ciphertext-2',
        kdf: 'scrypt',
        kdfparams: { salt: 'test-salt-2', n: 131072, dklen: 32, p: 1, r: 8 },
        mac: 'test-mac-2',
      },
    };
    fs.writeFileSync(walletFilePath, JSON.stringify(existingWallet, null, 2));

    // Mock checkAndPromptOverwrite to simulate user declining
    const { checkAndPromptOverwrite } = await import('../../src/utils');
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.mocked(checkAndPromptOverwrite).mockImplementationOnce(async () => {
      process.exit(0);
    });

    // Pass directory path (not file path)
    await encryptAndSaveWallet(privateKey, mockedPassword, tmpDir.name);

    // Verify checkAndPromptOverwrite was called with the wallet.json path
    expect(checkAndPromptOverwrite).toHaveBeenCalledWith(walletFilePath);

    // Verify process.exit was called
    expect(mockExit).toHaveBeenCalledWith(0);

    // Cleanup
    mockExit.mockRestore();
    if (fs.existsSync(walletFilePath)) {
      fs.unlinkSync(walletFilePath);
    }
    tmpDir.removeCallback();
  }, 30000);
});
