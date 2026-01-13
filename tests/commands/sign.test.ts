import * as prompts from '@inquirer/prompts';
import { issuer } from '@trustvc/trustvc';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { promptForInputs, sign } from '../../src/commands/sign';
import { SignInput } from '../../src/types';


vi.mock('@inquirer/prompts');

vi.mock('../../src/utils', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils')>('../../src/utils');
  return {
    ...actual,
    readJsonFile: vi.fn(),
    isDirectoryValid: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock('@trustvc/trustvc', async () => {
  const actual = await vi.importActual<typeof import('@trustvc/trustvc')>('@trustvc/trustvc');
  return {
    ...actual,
    signW3C: vi.fn(),
  };
});


const mockPromptFlow = (
  algorithm: 'ecdsa-sd-2023' | 'bbs-2023' = 'ecdsa-sd-2023',
) => {
  (prompts.input as any)
    .mockResolvedValueOnce('./did-keypair.json')
    .mockResolvedValueOnce('./credential.json')
    .mockResolvedValueOnce('.');

  (prompts.select as any).mockResolvedValueOnce(algorithm);
};

const mockUtilsHappyPath = async (
  keyPairData = { domain: 'https://example.com' },
  credential = { id: 'urn:uuid:123' },
) => {
  const utils = await import('../../src/utils');

  (utils.readJsonFile as MockedFunction<any>)
    .mockReturnValueOnce(keyPairData)
    .mockReturnValueOnce(credential);

  (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

  return utils;
};

const mockSignSuccess = async (signed: any) => {
  const trustvc = await import('@trustvc/trustvc');
  (trustvc.signW3C as MockedFunction<any>).mockResolvedValue({ signed });
};


describe('w3c-sign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('promptForInputs', () => {
    it('returns parsed inputs when algorithm is ecdsa-sd-2023', async () => {
      mockPromptFlow('ecdsa-sd-2023');
      await mockUtilsHappyPath();

      const result = await promptForInputs();

      expect(result).toStrictEqual({
        keyPairData: { domain: 'https://example.com' },
        credential: { id: 'urn:uuid:123' },
        encryptionAlgorithm: 'ecdsa-sd-2023',
        pathToSignedVC: '.',
      });
    });

    it('returns parsed inputs when algorithm is bbs-2023', async () => {
      mockPromptFlow('bbs-2023');
      await mockUtilsHappyPath();

      const result = await promptForInputs();

      expect(result).toStrictEqual({
        keyPairData: { domain: 'https://example.com' },
        credential: { id: 'urn:uuid:123' },
        encryptionAlgorithm: 'bbs-2023',
        pathToSignedVC: '.',
      });
    });

    it('provides required validation rules for inputs', async () => {
      mockPromptFlow('bbs-2023');
      await mockUtilsHappyPath();

      await promptForInputs();

      const [keypairArgs, credentialArgs, signedVcArgs] =
        (prompts.input as any).mock.calls.map((c: any[]) => c[0]);

      expect(keypairArgs.required).toBe(true);
      expect(keypairArgs.validate('')).toBe('did key-pair JSON file path is required');
      expect(keypairArgs.validate('   ')).toBe('did key-pair JSON file path is required');
      expect(keypairArgs.validate('./did-keypair.json')).toBe(true);

      expect(credentialArgs.required).toBe(true);
      expect(credentialArgs.validate('')).toBe('Credential JSON file path is required');
      expect(credentialArgs.validate('   ')).toBe('Credential JSON file path is required');
      expect(credentialArgs.validate('./credential.json')).toBe(true);

      expect(signedVcArgs.required).toBe(false);
      expect(signedVcArgs.default).toBe('.');
    });

    it('prompts for encryption algorithm with supported choices', async () => {
      mockPromptFlow();
      await mockUtilsHappyPath();

      await promptForInputs();

      const selectArgs = (prompts.select as any).mock.calls[0][0];

      expect(selectArgs.message).toContain('Select the encryption algorithm');
      expect(selectArgs.choices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: 'ecdsa-sd-2023' }),
          expect.objectContaining({ value: 'bbs-2023' }),
        ]),
      );
    });

    it('throws when given an invalid did key-pair file path (readJsonFile fails)', async () => {
      mockPromptFlow('ecdsa-sd-2023');
      const utils = await import('../../src/utils');

      (utils.readJsonFile as MockedFunction<any>).mockImplementation(() => {
        throw new Error('Invalid key pair file path: ./did-keypair.json');
      });

      await expect(promptForInputs()).rejects.toThrow(
        'Invalid key pair file path: ./did-keypair.json',
      );
    });

    it('throws when given an invalid credential file path (readJsonFile fails)', async () => {
      mockPromptFlow('ecdsa-sd-2023');
      const utils = await import('../../src/utils');

      (utils.readJsonFile as MockedFunction<any>)
        .mockReturnValueOnce({ domain: 'https://example.com' })
        .mockImplementation(() => {
          throw new Error('Invalid credential JSON file path: ./credential.json');
        });
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(true);

      await expect(promptForInputs()).rejects.toThrow(
        'Invalid credential JSON file path: ./credential.json',
      );
    });

    it('throws when output path is not a valid directory', async () => {
      mockPromptFlow('ecdsa-sd-2023');
      const utils = await mockUtilsHappyPath();
      (utils.isDirectoryValid as MockedFunction<any>).mockReturnValue(false);

      await expect(promptForInputs()).rejects.toThrow('Output path is not valid');
    });
  });


  describe('sign', () => {
    let writeFileMock: MockedFunction<any>;
    let signW3CMock: MockedFunction<any>;

    const input: SignInput = {
      keyPairData: { domain: 'https://example.com' } as typeof issuer.IssuedDIDOption,
      credential: { id: 'urn:uuid:123' },
      encryptionAlgorithm: 'ecdsa-sd-2023',
      pathToSignedVC: '.',
    };

    beforeEach(async () => {
      const utils = await import('../../src/utils');
      writeFileMock = utils.writeFile as MockedFunction<any>;

      const trustvc = await import('@trustvc/trustvc');
      signW3CMock = trustvc.signW3C as MockedFunction<any>;
    });

    it('signs with ecdsa-sd-2023 and writes to default output path', async () => {
      signW3CMock.mockResolvedValue({ signed: { proof: 'ok' } });

      await sign({ ...input, encryptionAlgorithm: 'ecdsa-sd-2023', pathToSignedVC: '.' });

      expect(signW3CMock).toHaveBeenCalledWith(
        input.credential,
        input.keyPairData,
        'ecdsa-sd-2023',
      );
      expect(writeFileMock).toHaveBeenCalledWith('./signed_vc.json', { proof: 'ok' });
    });

    it('signs with bbs-2023 and writes to a custom output directory', async () => {
      signW3CMock.mockResolvedValue({ signed: { proof: 'ok' } });

      await sign({
        ...input,
        encryptionAlgorithm: 'bbs-2023',
        pathToSignedVC: './out',
      });

      expect(signW3CMock).toHaveBeenCalledWith(
        input.credential,
        input.keyPairData,
        'bbs-2023',
      );
      expect(writeFileMock).toHaveBeenCalledWith('./out/signed_vc.json', { proof: 'ok' });
    });

    it('does not write file when signing fails', async () => {
      signW3CMock.mockResolvedValue({ error: 'Failed to sign' });

      await sign(input);

      expect(writeFileMock).not.toHaveBeenCalled();
    });

    it('throws when writing signed VC fails', async () => {
      writeFileMock.mockImplementation(() => {
        throw new Error('Unexpected error while writing');
      });

      signW3CMock.mockResolvedValue({ signed: {} });

      await expect(sign(input)).rejects.toThrow('Unexpected error while writing');
    });
  });
});
