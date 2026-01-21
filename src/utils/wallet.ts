import { readFileSync } from 'fs';
import signale from 'signale';
import { JsonRpcProvider, Signer, Wallet, Provider, HDNodeWallet } from 'ethers';
import { addAddressPrefix } from './formatting';

import {
  isRpcUrlOption,
  isWalletOption,
  NetworkOption,
  PrivateKeyOption,
  RpcUrlOption,
  WalletOrSignerOption,
} from './cli-options';
import { readFile } from './file-io';
import inquirer from 'inquirer';
import { progress as defaultProgress } from './progress';
import { getSupportedNetwork } from './networks';

const getKeyFromFile = (file?: string): undefined | string => {
  return file ? readFileSync(file).toString().trim() : undefined;
};

export type ConnectedSigner = Signer & {
  readonly provider: Provider;
  readonly publicKey?: never;
  readonly privateKey?: never;
};

export const getPrivateKey = ({ keyFile, key }: PrivateKeyOption): string | undefined => {
  if (key) {
    signale.warn(
      'Be aware that entering the `key` value at the prompt may leave it in your shell history',
    );
    signale.warn(
      'Other options are available: use a key file or the OA_PRIVATE_KEY environment variable instead',
    );
  }
  return key || getKeyFromFile(keyFile) || process.env['OA_PRIVATE_KEY'];
};

export const getWalletOrSigner = async ({
  network,
  progress = defaultProgress('Decrypting Wallet'),
  ...options
}: WalletOrSignerOption &
  Partial<NetworkOption> &
  Partial<RpcUrlOption> & { progress?: (progress: number) => void }): Promise<
  Wallet | HDNodeWallet | ConnectedSigner
> => {
  // Use custom RPC URL if provided, otherwise use the default network provider
  const provider = isRpcUrlOption(options)
    ? new JsonRpcProvider(options.rpcUrl)
    : getSupportedNetwork(network ?? 'mainnet').provider();
  if (isWalletOption(options)) {
    const { password } = await inquirer.prompt({
      type: 'password',
      name: 'password',
      message: 'Wallet password',
    });

    const file = await readFile(options.encryptedWalletPath);
    const wallet = await Wallet.fromEncryptedJson(file, password, progress);
    signale.info('Wallet successfully decrypted');
    const connectedWallet = wallet.connect(provider);
    return connectedWallet as Wallet | HDNodeWallet;
  }
  //  else if (isAwsKmsSignerOption(options)) {
  //   const kmsCredentials = {
  //     accessKeyId: options.accessKeyId, // credentials for your IAM user with KMS access
  //     secretAccessKey: options.secretAccessKey, // credentials for your IAM user with KMS access
  //     region: options.region,
  //     keyId: options.kmsKeyId,
  //     sessionToken: options.sessionToken,
  //   };

  //   const signer = new AwsKmsSigner(kmsCredentials).connect(provider);
  //   if (signer.provider) return signer as ConnectedSigner;
  //   throw new Error('Unable to attach the provider to the kms signer');
  // }
  else {
    const privateKey = getPrivateKey(options as any);

    if (privateKey) {
      const hexlifiedPrivateKey = addAddressPrefix(privateKey);
      return new Wallet(hexlifiedPrivateKey, provider);
    }
  }
  throw new Error(
    'No private key found in OA_PRIVATE_KEY, key, key-file, please supply at least one or supply an encrypted wallet path, or provide aws kms signer information',
  );
};
