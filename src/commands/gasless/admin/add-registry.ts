import { error } from 'signale';
import { addRegistry } from '@trustvc/trustvc';
import { promptAddress } from '../../../utils';
import { promptForPaymasterAdminWalletInputs, runPaymasterAdminAction } from './common';

export const command = 'add-registry';

export const describe =
  'Authorizes a token registry so its calls can be sponsored by a PlatformPaymaster';

export const handler = async (): Promise<string | undefined> => {
  try {
    const base = await promptForPaymasterAdminWalletInputs();
    const registry = await promptAddress('registry', 'token registry address to authorize');

    return await runPaymasterAdminAction({
      ...base,
      actionLabel: `Authorizing registry ${registry}`,
      execute: (wallet) =>
        addRegistry(wallet, base.paymasterAddress as `0x${string}`, registry as `0x${string}`),
    });
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
