import { error } from 'signale';
import { addAuthorizedCaller } from '@trustvc/trustvc';
import { promptAddress } from '../../../utils';
import { promptForPaymasterAdminWalletInputs, runPaymasterAdminAction } from './common';

export const command = 'add-authorized-caller';

export const describe =
  'Authorizes an address to trigger sponsored holder/beneficiary title-escrow or registry calls (Path A) on a PlatformPaymaster';

export const handler = async (): Promise<string | undefined> => {
  try {
    const base = await promptForPaymasterAdminWalletInputs();
    const caller = await promptAddress('caller', 'address to authorize on the paymaster');

    return await runPaymasterAdminAction({
      ...base,
      actionLabel: `Authorizing caller ${caller}`,
      execute: (wallet) =>
        addAuthorizedCaller(
          wallet,
          base.paymasterAddress as `0x${string}`,
          caller as `0x${string}`,
        ),
    });
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
