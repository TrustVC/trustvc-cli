import { error } from 'signale';
import { addTitleEscrow } from '@trustvc/trustvc';
import { promptAddress } from '../../../utils';
import { promptForPaymasterAdminWalletInputs, runPaymasterAdminAction } from './common';

export const command = 'add-title-escrow';

export const describe =
  'Authorizes a title escrow so its calls can be sponsored by a PlatformPaymaster';

export const handler = async (): Promise<string | undefined> => {
  try {
    const base = await promptForPaymasterAdminWalletInputs();
    const titleEscrow = await promptAddress('title escrow', 'title escrow address to authorize');

    return await runPaymasterAdminAction({
      ...base,
      actionLabel: `Authorizing title escrow ${titleEscrow}`,
      execute: (wallet) =>
        addTitleEscrow(
          wallet,
          base.paymasterAddress as `0x${string}`,
          titleEscrow as `0x${string}`,
        ),
    });
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
