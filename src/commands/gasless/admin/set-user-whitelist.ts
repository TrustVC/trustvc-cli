import { error } from 'signale';
import { input } from '@inquirer/prompts';
import { setUserWhitelist } from '@trustvc/trustvc';
import { promptAddress } from '../../../utils';
import { promptForPaymasterAdminWalletInputs, runPaymasterAdminAction } from './common';

export const command = 'set-user-whitelist';

export const describe =
  'Whitelists a user on a PlatformPaymaster and sets their token-registry deployment credit allowance (0-3)';

export const handler = async (): Promise<string | undefined> => {
  try {
    const base = await promptForPaymasterAdminWalletInputs();
    const user = await promptAddress(
      'user',
      'address to whitelist for gasless registry deployment',
    );

    const credits = await input({
      message: 'Enter the deployment credit allowance (0-3):',
      required: true,
      validate: (value: string) => {
        if (!/^[0-3]$/.test(value)) {
          return 'Credits must be an integer between 0 and 3';
        }
        return true;
      },
    });

    return await runPaymasterAdminAction({
      ...base,
      actionLabel: `Whitelisting user ${user} with ${credits} credit(s)`,
      execute: (wallet) =>
        setUserWhitelist(
          wallet,
          base.paymasterAddress as `0x${string}`,
          user as `0x${string}`,
          BigInt(credits),
        ),
    });
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
