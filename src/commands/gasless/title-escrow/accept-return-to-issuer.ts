import { error, info, success } from 'signale';
import { acceptReturnedGasless } from '@trustvc/trustvc';
import {
  extractDocumentInfo,
  getErrorMessage,
  getEtherscanAddress,
  promptAddress,
  promptAndReadDocument,
  promptRemark,
  promptWalletSelection,
  verifyDocumentSignature,
} from '../../../utils';
import { validateAndEncryptRemark } from '../../helpers';
import { assertGaslessSupportedNetwork } from '../config';
import { prepareGaslessRegistryRun } from '../common';
import { TokenRegistryReturnedDocumentGaslessCommand } from '../types';

/** Prompt for all inputs needed to gaslessly accept a returned transferable record. */
export const promptForGaslessAcceptReturnToIssuerInputs =
  async (): Promise<TokenRegistryReturnedDocumentGaslessCommand> => {
    const document = await promptAndReadDocument();
    await verifyDocumentSignature(document);

    const { tokenRegistry, tokenId, network, documentId, registryVersion } =
      await extractDocumentInfo(document);
    assertGaslessSupportedNetwork(network);

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
      paymasterAddress: paymasterAddress as string,
      remark,
      encryptionKey: documentId,
      encryptedWalletPath,
      key,
      keyFile,
    };
  };

/**
 * Runs a gasless accept-return-to-issuer transaction end to end: this acts directly on the token
 * registry contract (the registry admin burns the token) rather than a title escrow, so there is
 * no title-escrow role check — the on-chain contract enforces who may call it. Recovers the
 * caller's raw private key, checks the account is eligible for sponsorship, then submits the
 * sponsored UserOperation via @trustvc/trustvc's `acceptReturnedGasless`.
 */
export const runAcceptReturnToIssuerGasless = async (
  args: TokenRegistryReturnedDocumentGaslessCommand,
): Promise<string | undefined> => {
  try {
    // Validates remark length up front; the encrypted value returned here is unused because
    // acceptReturnedGasless() re-derives and encrypts the remark itself from the raw string.
    validateAndEncryptRemark(args.remark, args.encryptionKey);

    const { network, smartAccountClient } = await prepareGaslessRegistryRun(args);

    info(
      `Submitting gasless acceptance of the returned document with tokenId ${args.tokenId}. Gas is sponsored by the PlatformPaymaster — no ETH is required from your wallet.`,
    );

    const transactionHash = await acceptReturnedGasless(
      { tokenRegistryAddress: args.tokenRegistryAddress },
      smartAccountClient,
      { tokenId: args.tokenId, remarks: args.remark },
      { id: args.encryptionKey },
    );

    success(`Returned transferable record with tokenId ${args.tokenId} has been accepted.`);
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${transactionHash}`);

    return transactionHash;
  } catch (e) {
    error(getErrorMessage(e));
  }
};
