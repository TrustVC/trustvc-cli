import * as prompts from '@inquirer/prompts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  getHolderDidFromKeyPair,
  nameFailingCredential,
  promptForInputs,
  resolveCredentialPaths,
  signPresentation,
} from '../../../src/commands/w3c/vp-sign';

vi.mock('@inquirer/prompts');

vi.mock('signale', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
  Signale: vi.fn().mockImplementation(() => ({
    await: vi.fn(),
    success: vi.fn(),
  })),
}));

vi.mock('../../../src/utils', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils')>('../../../src/utils');
  return {
    ...actual,
    readJsonFile: vi.fn(),
    isDirectoryValid: vi.fn(),
    validateInputFileExists: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    signW3CPresentation: vi.fn(),
  };
});

const HOLDER_DID = 'did:key:zDnaemDNwi4G5eTzGfRooFFu5Kns3be6yfyVNtiaMhWkZbwtc';
const KEY_PAIR = {
  id: `${HOLDER_DID}#zDnaemDNwi4G5eTzGfRooFFu5Kns3be6yfyVNtiaMhWkZbwtc`,
  controller: HOLDER_DID,
  type: 'Multikey',
};

describe('vp-sign', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  afterAll(() => {
    tempDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  });

  describe('getHolderDidFromKeyPair', () => {
    it('should use the controller when present', () => {
      expect(getHolderDidFromKeyPair(KEY_PAIR as never)).toBe(HOLDER_DID);
    });

    it('should fall back to the DID part of the verification method id', () => {
      expect(getHolderDidFromKeyPair({ id: `${HOLDER_DID}#multikey-1` } as never)).toBe(HOLDER_DID);
    });

    it('should return undefined when the key pair carries no DID', () => {
      expect(getHolderDidFromKeyPair({} as never)).toBeUndefined();
    });
  });

  describe('resolveCredentialPaths', () => {
    let dir: string;

    const makeDir = () => {
      const created = fs.mkdtempSync(path.join(os.tmpdir(), 'trustvc-vp-dir-'));
      tempDirs.push(created);
      return created;
    };

    it('passes a single file path through unchanged', () => {
      expect(resolveCredentialPaths('./signed_vc.json')).toStrictEqual(['./signed_vc.json']);
    });

    it('splits and trims comma-separated file paths', () => {
      expect(resolveCredentialPaths(' ./a.json , ./b.json ')).toStrictEqual([
        './a.json',
        './b.json',
      ]);
    });

    it('expands a directory to every file inside it, in a stable order', () => {
      dir = makeDir();
      fs.writeFileSync(path.join(dir, 'b.json'), '{}');
      fs.writeFileSync(path.join(dir, 'a.json'), '{}');
      // No extension filtering — whatever is in the directory is presented, and an invalid
      // credential is reported by the signing step rather than silently dropped.
      fs.writeFileSync(path.join(dir, 'c.txt'), 'not json');

      expect(resolveCredentialPaths(dir)).toStrictEqual([
        path.join(dir, 'a.json'),
        path.join(dir, 'b.json'),
        path.join(dir, 'c.txt'),
      ]);
    });

    it('skips dot-files and sub-directories (OS noise, not credentials)', () => {
      dir = makeDir();
      fs.writeFileSync(path.join(dir, 'vc.json'), '{}');
      fs.writeFileSync(path.join(dir, '.DS_Store'), 'junk');
      fs.mkdirSync(path.join(dir, 'nested'));

      expect(resolveCredentialPaths(dir)).toStrictEqual([path.join(dir, 'vc.json')]);
    });

    it('throws when the directory is empty', () => {
      dir = makeDir();
      expect(() => resolveCredentialPaths(dir)).toThrow(`No files found in directory: ${dir}`);
    });
  });

  describe('nameFailingCredential', () => {
    it('names the file a rejected credential came from', () => {
      const error = 'credential at index 1 is about "did:key:zOther", which does not match';
      expect(nameFailingCredential(error, ['./a.json', './b.json'])).toBe(
        'credential at index 1 (./b.json) is about "did:key:zOther", which does not match',
      );
    });

    it('leaves the message alone when the paths are unknown or out of range', () => {
      const error = 'credential at index 5 is not valid';
      expect(nameFailingCredential(error, undefined)).toBe(error);
      expect(nameFailingCredential(error, ['./a.json'])).toBe(error);
    });
  });

  describe('promptForInputs', () => {
    const mockUtils = async () => {
      const utils = await import('../../../src/utils');
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);
      (utils.validateInputFileExists as MockedFunction<any>).mockReturnValue(true);
      return utils;
    };

    it('should return parsed inputs for a single credential', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./signed_vc.json') // credential path(s)
        .mockResolvedValueOnce('./didKeyPairs.json') // key pair path
        .mockResolvedValueOnce('.'); // output directory
      (prompts.select as any).mockResolvedValueOnce('expiresInSeconds');
      (prompts.number as any).mockResolvedValueOnce(600);

      const utils = await mockUtils();
      (utils.readJsonFile as MockedFunction<any>)
        .mockReturnValueOnce({ id: 'urn:uuid:123' })
        .mockReturnValueOnce(KEY_PAIR);

      const result = await promptForInputs();

      expect(result).toStrictEqual({
        credentials: [{ id: 'urn:uuid:123' }],
        credentialPaths: ['./signed_vc.json'],
        keyPairData: KEY_PAIR,
        holder: HOLDER_DID,
        lifetime: { expiresInSeconds: 600 },
        outputPath: '.',
      });
      // Credentials, key pair, output directory — no challenge, no holder question.
      expect((prompts.input as any).mock.calls.length).toBe(3);
    });

    it('should read every comma-separated credential path', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce(' ./vc-1.json , ./vc-2.json ')
        .mockResolvedValueOnce('./didKeyPairs.json')
        .mockResolvedValueOnce('.');
      (prompts.select as any).mockResolvedValueOnce('expiresInSeconds');
      (prompts.number as any).mockResolvedValueOnce(600);

      const utils = await mockUtils();
      (utils.readJsonFile as MockedFunction<any>)
        .mockReturnValueOnce({ id: 'urn:uuid:1' })
        .mockReturnValueOnce({ id: 'urn:uuid:2' })
        .mockReturnValueOnce(KEY_PAIR);

      const result = await promptForInputs();

      expect(result.credentials).toStrictEqual([{ id: 'urn:uuid:1' }, { id: 'urn:uuid:2' }]);
      expect(utils.readJsonFile).toHaveBeenNthCalledWith(
        1,
        './vc-1.json',
        'Verifiable Credential JSON',
      );
      expect(utils.readJsonFile).toHaveBeenNthCalledWith(
        2,
        './vc-2.json',
        'Verifiable Credential JSON',
      );
    });

    it('should read every file when a directory is given', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trustvc-vp-prompt-'));
      tempDirs.push(dir);
      fs.writeFileSync(path.join(dir, 'vc-1.json'), '{}');
      fs.writeFileSync(path.join(dir, 'vc-2.json'), '{}');

      (prompts.input as any)
        .mockResolvedValueOnce(dir) // a directory, not a file
        .mockResolvedValueOnce('./didKeyPairs.json')
        .mockResolvedValueOnce('.');
      (prompts.select as any).mockResolvedValueOnce('expiresInSeconds');
      (prompts.number as any).mockResolvedValueOnce(600);

      const utils = await mockUtils();
      (utils.readJsonFile as MockedFunction<any>)
        .mockReturnValueOnce({ id: 'urn:uuid:1' })
        .mockReturnValueOnce({ id: 'urn:uuid:2' })
        .mockReturnValueOnce(KEY_PAIR);

      const result = await promptForInputs();

      expect(result.credentials).toStrictEqual([{ id: 'urn:uuid:1' }, { id: 'urn:uuid:2' }]);
      expect(result.credentialPaths).toStrictEqual([
        path.join(dir, 'vc-1.json'),
        path.join(dir, 'vc-2.json'),
      ]);
      // A directory is accepted by the prompt without per-file validation.
      expect((prompts.input as any).mock.calls[0][0].validate(dir)).toBe(true);
    });

    it('should accept an explicit validUntil as the lifetime', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./signed_vc.json')
        .mockResolvedValueOnce('./didKeyPairs.json')
        .mockResolvedValueOnce('2999-01-01T00:00:00Z') // validUntil
        .mockResolvedValueOnce('.');
      (prompts.select as any).mockResolvedValueOnce('validUntil');

      const utils = await mockUtils();
      (utils.readJsonFile as MockedFunction<any>)
        .mockReturnValueOnce({ id: 'urn:uuid:123' })
        .mockReturnValueOnce(KEY_PAIR);

      const result = await promptForInputs();

      expect(result.lifetime).toStrictEqual({ validUntil: '2999-01-01T00:00:00Z' });
      expect(prompts.number).not.toHaveBeenCalled();
    });

    it('should take the holder from the key pair without asking', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./signed_vc.json')
        .mockResolvedValueOnce('./didKeyPairs.json')
        .mockResolvedValueOnce('.');
      (prompts.select as any).mockResolvedValueOnce('expiresInSeconds');
      (prompts.number as any).mockResolvedValueOnce(600);

      const utils = await mockUtils();
      (utils.readJsonFile as MockedFunction<any>)
        .mockReturnValueOnce({ id: 'urn:uuid:123' })
        .mockReturnValueOnce(KEY_PAIR);

      const result = await promptForInputs();

      expect(result.holder).toBe(HOLDER_DID);
      // Credentials, key pair, output directory — no holder question.
      expect((prompts.input as any).mock.calls.length).toBe(3);
      const asked = (prompts.input as any).mock.calls.map((call: any[]) => call[0].message);
      expect(asked.some((message: string) => /Enter the holder DID/i.test(message))).toBe(false);
    });

    it('should reject a key pair that is not bound to a DID', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./signed_vc.json')
        .mockResolvedValueOnce('./keypair.json') // the bare file `key-pair-generation` writes
        .mockResolvedValueOnce('.');

      const utils = await mockUtils();
      (utils.readJsonFile as MockedFunction<any>)
        .mockReturnValueOnce({ id: 'urn:uuid:123' })
        .mockReturnValueOnce({
          type: 'Multikey',
          secretKeyMultibase: 'z42',
          publicKeyMultibase: 'zDn',
        });

      await expect(promptForInputs()).rejects.toThrow(
        'The key pair at ./keypair.json is not bound to a DID (no "controller").',
      );
    });

    it('should abide by the validation rules of each prompt', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./signed_vc.json')
        .mockResolvedValueOnce('./didKeyPairs.json')
        .mockResolvedValueOnce('2999-01-01T00:00:00Z') // validUntil
        .mockResolvedValueOnce('.');
      (prompts.select as any).mockResolvedValueOnce('validUntil');

      const utils = await mockUtils();
      (utils.readJsonFile as MockedFunction<any>)
        .mockReturnValueOnce({ id: 'urn:uuid:123' })
        .mockReturnValueOnce(KEY_PAIR);
      (utils.validateInputFileExists as MockedFunction<any>).mockImplementation((...args: any[]) =>
        args[0] === './missing.json' ? 'File not found: ./missing.json' : true,
      );

      await promptForInputs();

      const credentialPrompt = (prompts.input as any).mock.calls[0][0];
      expect(credentialPrompt.validate('')).toBe(
        'A directory or at least one credential file is required',
      );
      expect(credentialPrompt.validate('./vc-1.json,./missing.json')).toBe(
        'File not found: ./missing.json',
      );
      expect(credentialPrompt.validate('./vc-1.json, ./vc-2.json')).toBe(true);

      const validUntilPrompt = (prompts.input as any).mock.calls[2][0];
      expect(validUntilPrompt.validate('not-a-date')).toBe('Enter a valid ISO 8601 timestamp');
      expect(validUntilPrompt.validate('2020-01-01T00:00:00Z')).toBe(
        'validUntil must be in the future',
      );
      expect(validUntilPrompt.validate('2999-01-01T00:00:00Z')).toBe(true);
    });

    it('should throw when the output directory is invalid', async () => {
      (prompts.input as any)
        .mockResolvedValueOnce('./signed_vc.json')
        .mockResolvedValueOnce('./didKeyPairs.json')
        .mockResolvedValueOnce('/does/not/exist');
      (prompts.select as any).mockResolvedValueOnce('expiresInSeconds');
      (prompts.number as any).mockResolvedValueOnce(600);

      const utils = await import('../../../src/utils');
      (utils.readJsonFile as MockedFunction<any>)
        .mockReturnValueOnce({ id: 'urn:uuid:123' })
        .mockReturnValueOnce(KEY_PAIR);
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(false);

      await expect(promptForInputs()).rejects.toThrow('Output path is not valid');
    });
  });

  describe('signPresentation', () => {
    const baseInput = {
      credentials: [{ id: 'urn:uuid:123' }],
      keyPairData: KEY_PAIR,
      holder: HOLDER_DID,
      lifetime: { expiresInSeconds: 600 },
      outputPath: '.',
    } as never as Parameters<typeof signPresentation>[0];

    it('should pass a single credential through unwrapped and save the signed VP', async () => {
      const trustvc = await import('@trustvc/trustvc');
      (trustvc.signW3CPresentation as MockedFunction<any>).mockResolvedValue({
        signed: { type: ['VerifiablePresentation'] },
      });
      const utils = await import('../../../src/utils');

      await signPresentation(baseInput);

      // No challenge/domain: the CLI always produces an assertionMethod proof.
      expect(trustvc.signW3CPresentation).toHaveBeenCalledWith({ id: 'urn:uuid:123' }, KEY_PAIR, {
        holder: HOLDER_DID,
        expiresInSeconds: 600,
      });
      // path.join normalises the '.' away.
      expect(utils.writeFile).toHaveBeenCalledWith(
        'signed_vp.json',
        { type: ['VerifiablePresentation'] },
        true,
      );
    });

    it('should pass multiple credentials as an array', async () => {
      const trustvc = await import('@trustvc/trustvc');
      (trustvc.signW3CPresentation as MockedFunction<any>).mockResolvedValue({
        signed: { type: ['VerifiablePresentation'] },
      });

      await signPresentation({
        ...baseInput,
        credentials: [{ id: 'urn:uuid:1' }, { id: 'urn:uuid:2' }],
      } as never);

      expect(trustvc.signW3CPresentation).toHaveBeenCalledWith(
        [{ id: 'urn:uuid:1' }, { id: 'urn:uuid:2' }],
        KEY_PAIR,
        { holder: HOLDER_DID, expiresInSeconds: 600 },
      );
    });

    it('should name the file a rejected credential came from', async () => {
      const trustvc = await import('@trustvc/trustvc');
      (trustvc.signW3CPresentation as MockedFunction<any>).mockResolvedValue({
        error: 'credential at index 1 is not valid: bad',
      });
      const signale = await import('signale');

      await signPresentation({
        ...baseInput,
        credentials: [{ id: 'urn:uuid:1' }, { id: 'urn:uuid:2' }],
        credentialPaths: ['./vc-dir/a.json', './vc-dir/b.json'],
      } as never);

      expect((signale.default as any).error).toHaveBeenCalledWith(
        'credential at index 1 (./vc-dir/b.json) is not valid: bad',
      );
    });

    it('should report the error and write nothing when signing fails', async () => {
      const trustvc = await import('@trustvc/trustvc');
      (trustvc.signW3CPresentation as MockedFunction<any>).mockResolvedValue({
        error: 'credentialSubject.id does not match the holder',
      });
      const utils = await import('../../../src/utils');
      const signale = await import('signale');

      await signPresentation(baseInput);

      expect((signale.default as any).error).toHaveBeenCalledWith(
        'credentialSubject.id does not match the holder',
      );
      expect(utils.writeFile).not.toHaveBeenCalled();
    });
  });
});
