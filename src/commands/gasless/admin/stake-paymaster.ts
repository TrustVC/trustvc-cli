import { error } from 'signale';
import { input } from '@inquirer/prompts';
import { ethers } from 'ethers';
import { eip7702Abis } from '@trustvc/trustvc';
import { promptForPaymasterAdminWalletInputs, runPaymasterAdminAction } from './common';

export const command = 'stake-paymaster';

export const describe =
  "Stakes ETH for a PlatformPaymaster on the EntryPoint — an anti-spam bond many bundlers (including Pimlico) require before they'll accept UserOperations sponsored by it. Regular transaction — the caller pays the staked amount plus gas.";

export const handler = async (): Promise<string | undefined> => {
  try {
    const base = await promptForPaymasterAdminWalletInputs();

    const amountEth = await input({
      message: 'Enter the amount to stake in ETH:',
      required: true,
      validate: (value: string) => {
        if (!/^\d*\.?\d+$/.test(value) || Number(value) <= 0) {
          return 'Amount must be a positive number (ETH)';
        }
        return true;
      },
    });
    const amount = ethers.parseEther(amountEth);

    const unstakeDelaySec = await input({
      message: 'Enter the unstake delay in seconds (optional, defaults to 86400 = 1 day):',
      default: '86400',
      validate: (value: string) => {
        if (!/^\d+$/.test(value) || Number(value) <= 0) {
          return 'Unstake delay must be a positive integer (seconds)';
        }
        return true;
      },
    });

    return await runPaymasterAdminAction({
      ...base,
      actionLabel: `Staking ${amountEth} ETH with a ${unstakeDelaySec}s unstake delay`,
      execute: async (wallet) => {
        const contract = new ethers.Contract(
          base.paymasterAddress,
          eip7702Abis.platformPaymasterAbi,
          wallet,
        );
        const tx = await contract.addStake(Number(unstakeDelaySec), { value: amount });
        const receipt = await tx.wait();
        return receipt.hash as `0x${string}`;
      },
    });
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};
