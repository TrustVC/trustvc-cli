import { createPublicClient, http } from 'viem';
import { eip7702Abis, v5Contracts, v5RoleHash } from '@trustvc/trustvc';
import { GaslessSupportedNetwork, getGaslessRpcUrl, getViemChain } from './config';

export type CheckGaslessEligibilityArgs = {
  network: GaslessSupportedNetwork;
  paymasterAddress: `0x${string}`;
  callerAddress: `0x${string}`;
} & (
  | { titleEscrowAddress: `0x${string}`; registryAddress?: never }
  | { titleEscrowAddress?: never; registryAddress: `0x${string}` }
);

/**
 * Verifies that the PlatformPaymaster will actually sponsor this transaction before we build a
 * smart account client and submit a UserOperation. Checks, against the paymaster contract:
 *  - it is a deployed contract at the given address
 *  - the title escrow (or, for registry-level actions, the token registry) being acted on is authorized
 *  - the caller is an authorized caller
 *  - the caller's daily sponsored-gas spend limit has not been reached
 *  - the paymaster has a non-zero deposit at the EntryPoint to draw gas from
 *
 * Throws a descriptive error naming the failed check; does nothing on success.
 */
export const checkGaslessEligibility = async ({
  network,
  paymasterAddress,
  callerAddress,
  titleEscrowAddress,
  registryAddress,
}: CheckGaslessEligibilityArgs): Promise<void> => {
  const publicClient = createPublicClient({
    chain: getViemChain(network),
    transport: http(getGaslessRpcUrl(network)),
  });
  const abi = eip7702Abis.platformPaymasterAbi;

  const paymasterCode = await publicClient.getCode({ address: paymasterAddress });
  if (!paymasterCode || paymasterCode === '0x') {
    throw new Error(
      `No PlatformPaymaster contract found at ${paymasterAddress} on ${network}. Check the address and try again.`,
    );
  }

  const [isActedOnAddressAuthorized, isCallerAuthorized, dailySpend, deposit] = await Promise.all([
    publicClient.readContract(
      titleEscrowAddress
        ? {
            address: paymasterAddress,
            abi,
            functionName: 'authorizedTitleEscrows',
            args: [titleEscrowAddress],
          }
        : {
            address: paymasterAddress,
            abi,
            functionName: 'authorizedRegistries',
            args: [registryAddress],
          },
    ),
    publicClient.readContract({
      address: paymasterAddress,
      abi,
      functionName: 'authorizedCallers',
      args: [callerAddress],
    }),
    publicClient.readContract({
      address: paymasterAddress,
      abi,
      functionName: 'getUserDailySpend',
      args: [callerAddress],
    }),
    publicClient.readContract({
      address: paymasterAddress,
      abi,
      functionName: 'getDeposit',
    }),
  ]);

  if (!isActedOnAddressAuthorized) {
    throw new Error(
      titleEscrowAddress
        ? `This account cannot perform a gasless transaction: title escrow ${titleEscrowAddress} is not ` +
            `authorized on the PlatformPaymaster (${paymasterAddress}). Ask the paymaster owner to call addTitleEscrow first.`
        : `This account cannot perform a gasless transaction: token registry ${registryAddress} is not ` +
            `authorized on the PlatformPaymaster (${paymasterAddress}). Ask the paymaster owner to call addRegistry first.`,
    );
  }

  if (!isCallerAuthorized) {
    throw new Error(
      `This account cannot perform a gasless transaction: caller ${callerAddress} is not an authorized ` +
        `caller on the PlatformPaymaster (${paymasterAddress}). Ask the paymaster owner to call addAuthorizedCaller first.`,
    );
  }

  const [spent, limit] = dailySpend;
  if (limit > 0n && spent >= limit) {
    throw new Error(
      `This account cannot perform a gasless transaction: daily sponsored-gas limit reached for ` +
        `${callerAddress} (spent ${spent.toString()} of ${limit.toString()} wei). Try again after the daily limit resets.`,
    );
  }

  if ((deposit as unknown as bigint) <= 0n) {
    throw new Error(
      `This account cannot perform a gasless transaction: the PlatformPaymaster (${paymasterAddress}) has ` +
        `no ETH deposited at the EntryPoint, so it cannot sponsor gas. Ask the paymaster owner to fund it.`,
    );
  }
};

export interface CheckGaslessDeployEligibilityArgs {
  network: GaslessSupportedNetwork;
  paymasterAddress: `0x${string}`;
  callerAddress: `0x${string}`;
}

/**
 * Verifies eligibility for `deployRegistry` on the PlatformPaymaster ("Path B" — credit-gated,
 * unrelated to `authorizedCallers`/`authorizedTitleEscrows`/`authorizedRegistries`). Checks:
 *  - it is a deployed contract at the given address
 *  - the caller has at least one deployment credit (`userWhitelist`)
 *  - the paymaster has a non-zero deposit at the EntryPoint to draw gas from
 *
 * Throws a descriptive error naming the failed check; does nothing on success.
 */
export const checkGaslessDeployEligibility = async ({
  network,
  paymasterAddress,
  callerAddress,
}: CheckGaslessDeployEligibilityArgs): Promise<void> => {
  const publicClient = createPublicClient({
    chain: getViemChain(network),
    transport: http(getGaslessRpcUrl(network)),
  });
  const abi = eip7702Abis.platformPaymasterAbi;

  const paymasterCode = await publicClient.getCode({ address: paymasterAddress });
  if (!paymasterCode || paymasterCode === '0x') {
    throw new Error(
      `No PlatformPaymaster contract found at ${paymasterAddress} on ${network}. Check the address and try again.`,
    );
  }

  const [credits, deposit] = await Promise.all([
    publicClient.readContract({
      address: paymasterAddress,
      abi,
      functionName: 'userWhitelist',
      args: [callerAddress],
    }),
    publicClient.readContract({
      address: paymasterAddress,
      abi,
      functionName: 'getDeposit',
    }),
  ]);

  if ((credits as unknown as bigint) <= 0n) {
    throw new Error(
      `This account cannot deploy a token registry gaslessly: caller ${callerAddress} has no deployment ` +
        `credits on the PlatformPaymaster (${paymasterAddress}). Ask the paymaster owner to call setUserWhitelist first.`,
    );
  }

  if ((deposit as unknown as bigint) <= 0n) {
    throw new Error(
      `This account cannot deploy a token registry gaslessly: the PlatformPaymaster (${paymasterAddress}) has ` +
        `no ETH deposited at the EntryPoint, so it cannot sponsor gas. Ask the paymaster owner to fund it.`,
    );
  }
};

export interface CheckGaslessMintEligibilityArgs {
  network: GaslessSupportedNetwork;
  paymasterAddress: `0x${string}`;
  registryAddress: `0x${string}`;
}

/**
 * Verifies eligibility for `mintDocument` on the PlatformPaymaster ("Path B" — `mintDocument` has
 * no caller restriction of its own; it just requires `authorizedRegistries[registry]` and then
 * calls `registry.mint(...)`, which succeeds only if the token registry has granted the
 * PlatformPaymaster contract itself the `MINTER_ROLE`. Granting that role is the token registry
 * owner's call, not the paymaster owner's). Checks:
 *  - it is a deployed contract at the given address
 *  - the token registry being minted on is authorized
 *  - the token registry has granted the PlatformPaymaster the `MINTER_ROLE`
 *  - the paymaster has a non-zero deposit at the EntryPoint to draw gas from
 *
 * Throws a descriptive error naming the failed check; does nothing on success.
 */
export const checkGaslessMintEligibility = async ({
  network,
  paymasterAddress,
  registryAddress,
}: CheckGaslessMintEligibilityArgs): Promise<void> => {
  const publicClient = createPublicClient({
    chain: getViemChain(network),
    transport: http(getGaslessRpcUrl(network)),
  });
  const abi = eip7702Abis.platformPaymasterAbi;

  const paymasterCode = await publicClient.getCode({ address: paymasterAddress });
  if (!paymasterCode || paymasterCode === '0x') {
    throw new Error(
      `No PlatformPaymaster contract found at ${paymasterAddress} on ${network}. Check the address and try again.`,
    );
  }

  const [isPaymasterMinter, isRegistryAuthorized, deposit] = await Promise.all([
    publicClient.readContract({
      address: registryAddress,
      abi: v5Contracts.TradeTrustToken__factory.abi,
      functionName: 'hasRole',
      args: [v5RoleHash.MinterRole, paymasterAddress],
    }),
    publicClient.readContract({
      address: paymasterAddress,
      abi,
      functionName: 'authorizedRegistries',
      args: [registryAddress],
    }),
    publicClient.readContract({
      address: paymasterAddress,
      abi,
      functionName: 'getDeposit',
    }),
  ]);

  if (!isPaymasterMinter) {
    throw new Error(
      `This account cannot mint gaslessly: the PlatformPaymaster (${paymasterAddress}) does not hold ` +
        `MINTER_ROLE on token registry ${registryAddress}. Ask the token registry's owner to grant it ` +
        `(e.g. via grantRole).`,
    );
  }

  if (!isRegistryAuthorized) {
    throw new Error(
      `This account cannot mint gaslessly: token registry ${registryAddress} is not authorized on the ` +
        `PlatformPaymaster (${paymasterAddress}). Ask the paymaster owner to call addRegistry first.`,
    );
  }

  if ((deposit as unknown as bigint) <= 0n) {
    throw new Error(
      `This account cannot mint gaslessly: the PlatformPaymaster (${paymasterAddress}) has no ETH deposited ` +
        `at the EntryPoint, so it cannot sponsor gas. Ask the paymaster owner to fund it.`,
    );
  }
};
