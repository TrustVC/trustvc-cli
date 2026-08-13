import { error, info, success, warn } from 'signale';
import { mintGasless } from '@trustvc/trustvc';
import {
  extractDocumentInfo,
  getErrorMessage,
  getEtherscanAddress,
  getWalletOrSigner,
  promptAddress,
  promptAndReadDocument,
  promptRemark,
  promptWalletSelection,
  verifyDocumentSignature,
} from '../../../utils';
import { validateAndEncryptRemark } from '../../helpers';
import { assertGaslessSupportedNetwork } from '../config';
import { buildGaslessSmartAccountClient } from '../client';
import { checkGaslessMintEligibility } from '../eligibility';
import { TokenRegistryMintGaslessCommand } from '../types';

/** Prompt for all inputs needed to gaslessly mint a hash to a token registry. */
export const promptForGaslessMintInputs = async (): Promise<TokenRegistryMintGaslessCommand> => {
  const document = await promptAndReadDocument();
  await verifyDocumentSignature(document);

  const { tokenRegistry, tokenId, network, documentId, registryVersion } =
    await extractDocumentInfo(document);
  assertGaslessSupportedNetwork(network);

  const beneficiary = await promptAddress('beneficiary', 'initial recipient');
  const holder = await promptAddress('holder', 'initial holder');
  const paymasterAddress = await promptAddress(
    'paymaster',
    'PlatformPaymaster contract that will sponsor this gasless transaction',
  );
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();
  const remark = await promptRemark(registryVersion);

  return {
    network,
    tokenRegistryAddress: tokenRegistry,
    tokenId,
    beneficiary: beneficiary as string,
    holder: holder as string,
    paymasterAddress: paymasterAddress as string,
    remark,
    encryptionKey: documentId,
    encryptedWalletPath,
    key,
    keyFile,
  };
};

/**
 * Runs a gasless mint end to end. Unlike title-escrow gasless actions, minting acts directly on
 * the PlatformPaymaster (mintDocument), which has no title escrow to resolve beforehand and is
 * gated by whether the token registry has granted the PlatformPaymaster the MINTER_ROLE, rather
 * than an authorized-caller list. Recovers the caller's raw private key, checks the account is
 * eligible for sponsorship, then submits the sponsored UserOperation via @trustvc/trustvc's
 * `mintGasless`.
 */
export const runMintGasless = async (
  args: TokenRegistryMintGaslessCommand,
): Promise<string | undefined> => {
  try {
    const network = assertGaslessSupportedNetwork(args.network);

    // Validates remark length up front; the encrypted value returned here is unused because
    // mintGasless() re-derives and encrypts the remark itself from the raw string.
    validateAndEncryptRemark(args.remark, args.encryptionKey);

    // This wallet is only used to recover the raw private key for the smart-account owner; no
    // transaction is ever signed or sent with it directly.
    const wallet = await getWalletOrSigner({
      network,
      encryptedWalletPath: args.encryptedWalletPath,
      key: args.key,
      keyFile: args.keyFile,
    });

    const privateKey = (wallet as { privateKey?: string }).privateKey;
    if (!privateKey) {
      throw new Error(
        'Gasless transactions require direct access to a private key (encrypted wallet file, --key, --key-file, or OA_PRIVATE_KEY). AWS KMS signers are not supported.',
      );
    }

    warn('Checking whether this account is eligible for a gasless (sponsored) transaction...');
    await checkGaslessMintEligibility({
      network,
      paymasterAddress: args.paymasterAddress as `0x${string}`,
      registryAddress: args.tokenRegistryAddress as `0x${string}`,
    });
    success('Account is eligible for a gasless transaction');

    const { smartAccountClient } = await buildGaslessSmartAccountClient({
      network,
      privateKey,
      paymasterAddress: args.paymasterAddress as `0x${string}`,
    });

    info(
      `Submitting gasless mint of tokenId ${args.tokenId} to registry ${args.tokenRegistryAddress} with beneficiary ${args.beneficiary} and holder ${args.holder}. Gas is sponsored by the PlatformPaymaster — no ETH is required from your wallet.`,
    );

    const transactionHash = await mintGasless(
      { paymasterAddress: args.paymasterAddress, tokenRegistryAddress: args.tokenRegistryAddress },
      smartAccountClient,
      {
        beneficiaryAddress: args.beneficiary,
        holderAddress: args.holder,
        tokenId: args.tokenId,
        remarks: args.remark,
      },
      { id: args.encryptionKey },
    );

    success(
      `Token with hash ${args.tokenId} has been minted on ${args.tokenRegistryAddress} with the initial recipient being ${args.beneficiary} and initial holder ${args.holder}`,
    );
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${transactionHash}`);

    return transactionHash;
  } catch (e) {
    error(getErrorMessage(e));
  }
};
