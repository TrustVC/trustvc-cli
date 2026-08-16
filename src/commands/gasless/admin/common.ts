import { error, info, success } from 'signale';
import {
  getErrorMessage,
  getEtherscanAddress,
  getWalletOrSigner,
  promptAddress,
  promptNetworkSelection,
  promptWalletSelection,
} from '../../../utils';
import { assertGaslessSupportedNetwork, redactPimlicoApiKey } from '../config';
import { GaslessWalletOption } from '../types';

/**
 * PlatformPaymaster admin functions (add/remove authorized caller, registry, title escrow;
 * user whitelist credits; daily limit) are all owner-only, regular (non-gasless) transactions —
 * the owner pays gas directly to configure their own paymaster.
 */
export type PaymasterAdminWalletCommand = GaslessWalletOption & {
  network: string;
  paymasterAddress: string;
};

export const promptForPaymasterAdminWalletInputs =
  async (): Promise<PaymasterAdminWalletCommand> => {
    const network = await promptNetworkSelection();
    assertGaslessSupportedNetwork(network);

    const paymasterAddress = await promptAddress(
      'paymaster',
      'PlatformPaymaster contract to administer',
    );

    const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

    return {
      network,
      paymasterAddress: paymasterAddress as string,
      encryptedWalletPath,
      key,
      keyFile,
    };
  };

export interface RunPaymasterAdminActionArgs extends PaymasterAdminWalletCommand {
  actionLabel: string;
  /** Wallet is a raw ethers Signer here, not a viem WalletClient — no smart account involved. */
  execute: (wallet: Awaited<ReturnType<typeof getWalletOrSigner>>) => Promise<`0x${string}`>;
}

/**
 * Shared runner for every paymaster admin action: resolves a regular wallet, runs the given
 * on-chain call, and reports the transaction hash. Errors are caught and logged here, so callers
 * only need to guard their own prompting step.
 */
export const runPaymasterAdminAction = async ({
  network,
  paymasterAddress,
  encryptedWalletPath,
  key,
  keyFile,
  actionLabel,
  execute,
}: RunPaymasterAdminActionArgs): Promise<string | undefined> => {
  try {
    const assertedNetwork = assertGaslessSupportedNetwork(network);

    const wallet = await getWalletOrSigner({
      network: assertedNetwork,
      encryptedWalletPath,
      key,
      keyFile,
    });

    info(`${actionLabel} on PlatformPaymaster ${paymasterAddress}...`);

    const txHash = await execute(wallet);

    success(`${actionLabel} — done`);
    info(`Find more details at ${getEtherscanAddress({ network: assertedNetwork })}/tx/${txHash}`);

    return txHash;
  } catch (e) {
    error(redactPimlicoApiKey(getErrorMessage(e)));
  }
};
