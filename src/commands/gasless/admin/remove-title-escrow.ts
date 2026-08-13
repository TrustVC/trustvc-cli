import { error } from 'signale';
import { removeTitleEscrow } from '@trustvc/trustvc';
import { promptAddress } from '../../../utils';
import { promptForPaymasterAdminWalletInputs, runPaymasterAdminAction } from './common';

export const command = 'remove-title-escrow';

export const describe = 'Deauthorizes a title escrow from a PlatformPaymaster';

export const handler = async (): Promise<string | undefined> => {
  try {
    const base = await promptForPaymasterAdminWalletInputs();
    const titleEscrow = await promptAddress('title escrow', 'title escrow address to deauthorize');

    return await runPaymasterAdminAction({
      ...base,
      actionLabel: `Deauthorizing title escrow ${titleEscrow}`,
      execute: (wallet) =>
        removeTitleEscrow(
          wallet,
          base.paymasterAddress as `0x${string}`,
          titleEscrow as `0x${string}`,
        ),
    });
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
