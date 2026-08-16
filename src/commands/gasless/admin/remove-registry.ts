import { error } from 'signale';
import { removeRegistry } from '@trustvc/trustvc';
import { promptAddress } from '../../../utils';
import { promptForPaymasterAdminWalletInputs, runPaymasterAdminAction } from './common';

export const command = 'remove-registry';

export const describe = 'Deauthorizes a token registry from a PlatformPaymaster';

export const handler = async (): Promise<string | undefined> => {
  try {
    const base = await promptForPaymasterAdminWalletInputs();
    const registry = await promptAddress('registry', 'token registry address to deauthorize');

    return await runPaymasterAdminAction({
      ...base,
      actionLabel: `Deauthorizing registry ${registry}`,
      execute: (wallet) =>
        removeRegistry(wallet, base.paymasterAddress as `0x${string}`, registry as `0x${string}`),
    });
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
