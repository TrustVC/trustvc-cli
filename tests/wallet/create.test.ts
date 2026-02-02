import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateAndSaveWallet } from '../../src/commands/wallet/create';
import fs from 'fs';
import path from 'path';
import tmp from 'tmp';
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
    writeFile: vi.fn((filePath: string, data: any) => {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }),
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

  it('should save the wallet with custom filename when file path is provided', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const customFilePath = `${tmpDir.name}/my-custom-wallet.json`;

    await generateAndSaveWallet(mockedPassword, customFilePath);

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
    expect(decryptedWallet.address).toEqual(expect.any(String));

    // Cleanup
    tmpDir.removeCallback();
  }, 30000);

  it('should create parent directories when file path with non-existent directories is provided', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const nestedFilePath = `${tmpDir.name}/nested/dir/my-wallet.json`;

    await generateAndSaveWallet(mockedPassword, nestedFilePath);

    expect(fs.existsSync(nestedFilePath)).toBe(true);

    const walletAsString = fs.readFileSync(nestedFilePath, 'utf-8');
    const walletJson = JSON.parse(walletAsString);

    // Verify the wallet JSON has the expected structure
    expect(walletJson).toHaveProperty('address');

    // Cleanup
    tmpDir.removeCallback();
  }, 30000);

  it('should create wallet.json in current directory when "." is provided', async () => {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });

    // Test with '.' which should create wallet.json in the current directory
    await generateAndSaveWallet(mockedPassword, '.');

    // The file should be created as 'wallet.json' in the current working directory
    const walletFilePath = 'wallet.json';
    expect(fs.existsSync(walletFilePath)).toBe(true);

    const walletAsString = fs.readFileSync(walletFilePath, 'utf-8');
    const walletJson = JSON.parse(walletAsString);

    // Verify the wallet JSON has the expected structure
    expect(walletJson).toHaveProperty('address');

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

    await generateAndSaveWallet(mockedPassword, walletFilePath);

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
    await generateAndSaveWallet(mockedPassword, tmpDir.name);

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
