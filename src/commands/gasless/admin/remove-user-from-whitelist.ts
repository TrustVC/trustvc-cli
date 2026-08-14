import { error } from 'signale';
import { removeUserFromWhitelist } from '@trustvc/trustvc';
import { promptAddress } from '../../../utils';
import { promptForPaymasterAdminWalletInputs, runPaymasterAdminAction } from './common';

export const command = 'remove-user-from-whitelist';

export const describe =
  'Removes a user from the PlatformPaymaster whitelist (sets their deployment credits to 0)';

export const handler = async (): Promise<string | undefined> => {
  try {
    const base = await promptForPaymasterAdminWalletInputs();
    const user = await promptAddress('user', 'address to remove from the whitelist');

    return await runPaymasterAdminAction({
      ...base,
      actionLabel: `Removing user ${user} from whitelist`,
      execute: (wallet) =>
        removeUserFromWhitelist(
          wallet,
          base.paymasterAddress as `0x${string}`,
          user as `0x${string}`,
        ),
    });
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
