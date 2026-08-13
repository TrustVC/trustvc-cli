import { error } from 'signale';
import { removeAuthorizedCaller } from '@trustvc/trustvc';
import { promptAddress } from '../../../utils';
import { promptForPaymasterAdminWalletInputs, runPaymasterAdminAction } from './common';

export const command = 'remove-authorized-caller';

export const describe =
  'Removes an address from the authorized-caller list (Path A) on a PlatformPaymaster';

export const handler = async (): Promise<string | undefined> => {
  try {
    const base = await promptForPaymasterAdminWalletInputs();
    const caller = await promptAddress('caller', 'address to remove from the paymaster');

    return await runPaymasterAdminAction({
      ...base,
      actionLabel: `Removing caller ${caller}`,
      execute: (wallet) =>
        removeAuthorizedCaller(
          wallet,
          base.paymasterAddress as `0x${string}`,
          caller as `0x${string}`,
        ),
    });
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
