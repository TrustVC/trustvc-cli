import { warn, success } from 'signale';
import { ethers } from 'ethers';
import { v5Contracts } from '@trustvc/trustvc';
import { getSupportedNetwork, getWalletOrSigner } from '../../utils';
import { assertGaslessSupportedNetwork, GaslessSupportedNetwork } from './config';
import { buildGaslessSmartAccountClient, GaslessSmartAccountClient } from './client';
import { checkGaslessEligibility } from './eligibility';
import { GaslessWalletOption } from './types';

const { TitleEscrow__factory, TradeTrustToken__factory } = v5Contracts;

/** Title escrow role(s) the connected wallet must currently hold to run a given gasless action. */
export type TitleEscrowRole = 'holder' | 'beneficiary';

export const resolveTitleEscrowAddress = async ({
  tokenRegistryAddress,
  tokenId,
  network,
}: {
  tokenRegistryAddress: string;
  tokenId: string;
  network: string;
}): Promise<string> => {
  const provider = getSupportedNetwork(network).provider();
  const tokenRegistry = new ethers.Contract(
    tokenRegistryAddress,
    TradeTrustToken__factory.abi,
    provider,
  );
  const titleEscrowAddress: string = await tokenRegistry.ownerOf(tokenId);

  if (!titleEscrowAddress || titleEscrowAddress === ethers.ZeroAddress) {
    throw new Error(`Unable to resolve the title escrow address for tokenId ${tokenId}`);
  }

  return titleEscrowAddress;
};

export type PrepareGaslessRunArgs = GaslessWalletOption & {
  network: string;
  tokenRegistryAddress: string;
  tokenId: string;
  paymasterAddress: string;
  /** Role(s) the connected wallet must currently hold on the title escrow (checked before submitting). */
  requiredRoles: TitleEscrowRole[];
};

export interface GaslessRunContext {
  network: GaslessSupportedNetwork;
  titleEscrowAddress: `0x${string}`;
  callerAddress: `0x${string}`;
  smartAccountClient: GaslessSmartAccountClient;
}

/**
 * Shared setup for every gasless title-escrow action: resolves the title escrow, recovers the
 * caller's raw private key, verifies the caller currently holds the required role(s), runs the
 * paymaster eligibility check, then builds the EIP-7702 smart account client.
 */
export const prepareGaslessRun = async ({
  network,
  tokenRegistryAddress,
  tokenId,
  paymasterAddress,
  encryptedWalletPath,
  key,
  keyFile,
  requiredRoles,
}: PrepareGaslessRunArgs): Promise<GaslessRunContext> => {
  const assertedNetwork = assertGaslessSupportedNetwork(network);

  const titleEscrowAddress = await resolveTitleEscrowAddress({
    tokenRegistryAddress,
    tokenId,
    network: assertedNetwork,
  });

  // This wallet is only used to recover the raw private key for the smart-account owner; no
  // transaction is ever signed or sent with it directly.
  const wallet = await getWalletOrSigner({
    network: assertedNetwork,
    encryptedWalletPath,
    key,
    keyFile,
  });

  const privateKey = (wallet as { privateKey?: string }).privateKey;
  if (!privateKey) {
    throw new Error(
      'Gasless transactions require direct access to a private key (encrypted wallet file, --key, --key-file, or OA_PRIVATE_KEY). AWS KMS signers are not supported.',
    );
  }

  const callerAddress = await wallet.getAddress();

  const titleEscrow = new ethers.Contract(
    titleEscrowAddress,
    TitleEscrow__factory.abi,
    getSupportedNetwork(assertedNetwork).provider(),
  );

  for (const role of requiredRoles) {
    const currentRoleHolder: string = await titleEscrow[role]();
    if (currentRoleHolder.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error(
        `The connected wallet (${callerAddress}) is not the current ${role} (${currentRoleHolder}) of this transferable record.`,
      );
    }
  }

  warn('Checking whether this account is eligible for a gasless (sponsored) transaction...');
  await checkGaslessEligibility({
    network: assertedNetwork,
    paymasterAddress: paymasterAddress as `0x${string}`,
    callerAddress: callerAddress as `0x${string}`,
    titleEscrowAddress: titleEscrowAddress as `0x${string}`,
  });
  success('Account is eligible for a gasless transaction');

  const { smartAccountClient } = await buildGaslessSmartAccountClient({
    network: assertedNetwork,
    privateKey,
    paymasterAddress: paymasterAddress as `0x${string}`,
  });

  return {
    network: assertedNetwork,
    titleEscrowAddress: titleEscrowAddress as `0x${string}`,
    callerAddress: callerAddress as `0x${string}`,
    smartAccountClient,
  };
};

export type PrepareGaslessRegistryRunArgs = GaslessWalletOption & {
  network: string;
  tokenRegistryAddress: string;
  paymasterAddress: string;
};

export interface GaslessRegistryRunContext {
  network: GaslessSupportedNetwork;
  callerAddress: `0x${string}`;
  smartAccountClient: GaslessSmartAccountClient;
}

/**
 * Shared setup for gasless actions that operate directly on the token registry contract rather
 * than a specific title escrow (e.g. accepting/rejecting a returned document, which the registry
 * admin performs). Recovers the caller's raw private key, runs the paymaster eligibility check
 * against the registry address, then builds the EIP-7702 smart account client. Unlike
 * `prepareGaslessRun`, there is no title-escrow role to check here — the registry contract itself
 * enforces who may call these functions.
 */
export const prepareGaslessRegistryRun = async ({
  network,
  tokenRegistryAddress,
  paymasterAddress,
  encryptedWalletPath,
  key,
  keyFile,
}: PrepareGaslessRegistryRunArgs): Promise<GaslessRegistryRunContext> => {
  const assertedNetwork = assertGaslessSupportedNetwork(network);

  // This wallet is only used to recover the raw private key for the smart-account owner; no
  // transaction is ever signed or sent with it directly.
  const wallet = await getWalletOrSigner({
    network: assertedNetwork,
    encryptedWalletPath,
    key,
    keyFile,
  });

  const privateKey = (wallet as { privateKey?: string }).privateKey;
  if (!privateKey) {
    throw new Error(
      'Gasless transactions require direct access to a private key (encrypted wallet file, --key, --key-file, or OA_PRIVATE_KEY). AWS KMS signers are not supported.',
    );
  }

  const callerAddress = await wallet.getAddress();

  warn('Checking whether this account is eligible for a gasless (sponsored) transaction...');
  await checkGaslessEligibility({
    network: assertedNetwork,
    paymasterAddress: paymasterAddress as `0x${string}`,
    callerAddress: callerAddress as `0x${string}`,
    registryAddress: tokenRegistryAddress as `0x${string}`,
  });
  success('Account is eligible for a gasless transaction');

  const { smartAccountClient } = await buildGaslessSmartAccountClient({
    network: assertedNetwork,
    privateKey,
    paymasterAddress: paymasterAddress as `0x${string}`,
  });

  return {
    network: assertedNetwork,
    callerAddress: callerAddress as `0x${string}`,
    smartAccountClient,
  };
};
