import { error } from 'signale';
import { input } from '@inquirer/prompts';
import { setDailyLimit } from '@trustvc/trustvc';
import { promptForPaymasterAdminWalletInputs, runPaymasterAdminAction } from './common';

export const command = 'set-daily-limit';

export const describe =
  'Sets the global daily sponsored-gas spend limit per user on a PlatformPaymaster';

export const handler = async (): Promise<string | undefined> => {
  try {
    const base = await promptForPaymasterAdminWalletInputs();

    const dailyLimit = await input({
      message: 'Enter the new daily limit in wei (0 = unlimited):',
      required: true,
      validate: (value: string) => {
        if (!/^\d+$/.test(value)) {
          return 'Daily limit must be a non-negative integer (wei)';
        }
        return true;
      },
    });

    return await runPaymasterAdminAction({
      ...base,
      actionLabel: `Setting daily limit to ${dailyLimit} wei`,
      execute: (wallet) =>
        setDailyLimit(wallet, base.paymasterAddress as `0x${string}`, BigInt(dailyLimit)),
    });
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
