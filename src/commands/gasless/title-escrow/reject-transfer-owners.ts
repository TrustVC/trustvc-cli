import { error, info, success } from 'signale';
import { rejectTransferOwnersGasless } from '@trustvc/trustvc';
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
import { assertGaslessSupportedNetwork, redactPimlicoApiKey } from '../config';
import { prepareGaslessRun } from '../common';
import { TitleEscrowRejectTransferGaslessCommand } from '../types';

/** Prompt for all inputs needed to gaslessly reject a pending owner-and-holder transfer. */
export const promptForGaslessRejectTransferOwnerHolderInputs =
  async (): Promise<TitleEscrowRejectTransferGaslessCommand> => {
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
 * Runs a gasless reject-transfer-owner-holder transaction end to end: resolves the title escrow,
 * recovers the caller's raw private key, checks the account is eligible for sponsorship, then
 * submits the sponsored UserOperation via @trustvc/trustvc's `rejectTransferOwnersGasless`.
 */
export const runRejectTransferOwnerHolderGasless = async (
  args: TitleEscrowRejectTransferGaslessCommand,
): Promise<string | undefined> => {
  try {
    // Validates remark length up front; the encrypted value returned here is unused because
    // rejectTransferOwnersGasless() re-derives and encrypts the remark itself from the raw string.
    validateAndEncryptRemark(args.remark, args.encryptionKey);

    info(
      `Resolving title escrow for tokenId ${args.tokenId} on registry ${args.tokenRegistryAddress}`,
    );
    // Rejecting an owner+holder transfer requires the caller to currently be both.
    const { network, titleEscrowAddress, smartAccountClient } = await prepareGaslessRun({
      ...args,
      requiredRoles: ['holder', 'beneficiary'],
    });

    info(
      `Submitting gasless rejection of the pending owner and holder transfer for tokenId ${args.tokenId}. Gas is sponsored by the PlatformPaymaster — no ETH is required from your wallet.`,
    );

    const transactionHash = await rejectTransferOwnersGasless(
      { titleEscrowAddress },
      smartAccountClient,
      { remarks: args.remark },
      { id: args.encryptionKey },
    );

    success(
      `Transferable record with tokenId ${args.tokenId}'s owner and holder transfer has been successfully rejected to previous owner and holder`,
    );
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${transactionHash}`);

    return transactionHash;
  } catch (e) {
    error(redactPimlicoApiKey(getErrorMessage(e)));
  }
};
