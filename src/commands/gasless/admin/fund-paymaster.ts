import { error } from 'signale';
import { input } from '@inquirer/prompts';
import { ethers } from 'ethers';
import { eip7702Abis } from '@trustvc/trustvc';
import { promptForPaymasterAdminWalletInputs, runPaymasterAdminAction } from './common';

export const command = 'fund-paymaster';

export const describe =
  "Deposits ETH into a PlatformPaymaster's EntryPoint gas balance so it can sponsor UserOperations. Regular transaction — the caller pays the deposited amount plus gas.";

export const handler = async (): Promise<string | undefined> => {
  try {
    const base = await promptForPaymasterAdminWalletInputs();

    const amountEth = await input({
      message: 'Enter the amount to deposit in ETH:',
      required: true,
      validate: (value: string) => {
        if (!/^\d*\.?\d+$/.test(value) || Number(value) <= 0) {
          return 'Amount must be a positive number (ETH)';
        }
        return true;
      },
    });
    const amount = ethers.parseEther(amountEth);

    return await runPaymasterAdminAction({
      ...base,
      actionLabel: `Depositing ${amountEth} ETH`,
      execute: async (wallet) => {
        const contract = new ethers.Contract(
          base.paymasterAddress,
          eip7702Abis.platformPaymasterAbi,
          wallet,
        );
        const tx = await contract.deposit({ value: amount });
        const receipt = await tx.wait();
        return receipt.hash as `0x${string}`;
      },
    });
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
