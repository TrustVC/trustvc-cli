import { error, info, success } from 'signale';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  getErrorMessage,
  getEtherscanAddress,
  getWalletOrSigner,
  promptNetworkSelection,
  promptWalletSelection,
} from '../../../utils';
import {
  assertGaslessSupportedNetwork,
  getEip7702ImplementationAddress,
  getGaslessRpcUrl,
  getViemChain,
  redactPimlicoApiKey,
} from '../config';

// Submits a standalone EIP-7702 authorization for a user's own EOA — the first of the three
// setup steps ("Delegate" in the README) needed before an account can act as a smart account.
// Regular, non-gasless transaction: the user pays gas to delegate their own account. Every gasless
// command already bundles this automatically with its first sponsored UserOperation, so running
// this separately is only needed to set delegation up ahead of time.
export const command = 'delegate-user';

export const describe =
  "Delegates a user's EOA to the deployed EIP7702Implementation contract via a standalone EIP-7702 authorization. Regular transaction — the user pays gas to delegate their own account.";

export const handler = async (): Promise<string | undefined> => {
  try {
    const network = await promptNetworkSelection();
    const assertedNetwork = assertGaslessSupportedNetwork(network);

    const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

    // Only used to recover the raw private key: viem needs a LocalAccount to sign the
    // authorization, not an ethers Signer.
    const wallet = await getWalletOrSigner({
      network: assertedNetwork,
      encryptedWalletPath,
      key,
      keyFile,
    });

    const privateKey = (wallet as { privateKey?: string }).privateKey;
    if (!privateKey) {
      throw new Error(
        'Delegating requires direct access to a private key (encrypted wallet file, --key, --key-file, or OA_PRIVATE_KEY). AWS KMS signers are not supported.',
      );
    }

    const implementationAddress = getEip7702ImplementationAddress(assertedNetwork);
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: getViemChain(assertedNetwork),
      transport: http(getGaslessRpcUrl(assertedNetwork)),
    });

    info(`Delegating ${account.address} to ${implementationAddress} on ${assertedNetwork}...`);

    // `executor: 'self'` tells viem the account signing the authorization is also the one
    // submitting the transaction, so it correctly uses nonce + 1 rather than the current nonce.
    const authorization = await walletClient.signAuthorization({
      contractAddress: implementationAddress,
      executor: 'self',
    });

    const txHash = await walletClient.sendTransaction({
      authorizationList: [authorization],
      to: account.address,
      value: 0n,
    });

    success(`Account ${account.address} delegated to ${implementationAddress}`);
    info(`Find more details at ${getEtherscanAddress({ network: assertedNetwork })}/tx/${txHash}`);

    return txHash;
  } catch (e) {
    error(redactPimlicoApiKey(getErrorMessage(e)));
  }
};
