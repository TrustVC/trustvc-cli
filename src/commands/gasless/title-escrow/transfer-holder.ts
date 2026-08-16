import { error, info, success } from 'signale';
import { transferHolderGasless } from '@trustvc/trustvc';
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
import { TitleEscrowTransferHolderGaslessCommand } from '../types';

/** Prompt for all inputs needed to gaslessly transfer the holder of a transferable record. */
export const promptForGaslessTransferHolderInputs =
  async (): Promise<TitleEscrowTransferHolderGaslessCommand> => {
    const document = await promptAndReadDocument();
    await verifyDocumentSignature(document);

    const { tokenRegistry, tokenId, network, documentId, registryVersion } =
      await extractDocumentInfo(document);
    assertGaslessSupportedNetwork(network);

    const newHolder = await promptAddress('new holder', 'new holder');
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
      newHolder: newHolder as string,
      paymasterAddress: paymasterAddress as string,
      remark,
      encryptionKey: documentId,
      encryptedWalletPath,
      key,
      keyFile,
    };
  };

/**
 * Runs a gasless transfer-holder transaction end to end: resolves the title escrow, recovers the
 * caller's raw private key, checks the account is eligible for sponsorship, then submits the
 * sponsored UserOperation via @trustvc/trustvc's `transferHolderGasless`.
 */
export const runTransferHolderGasless = async (
  args: TitleEscrowTransferHolderGaslessCommand,
): Promise<string | undefined> => {
  try {
    // Validates remark length up front; the encrypted value returned here is unused because
    // transferHolderGasless() re-derives and encrypts the remark itself from the raw string.
    validateAndEncryptRemark(args.remark, args.encryptionKey);

    info(
      `Resolving title escrow for tokenId ${args.tokenId} on registry ${args.tokenRegistryAddress}`,
    );
    const { network, titleEscrowAddress, smartAccountClient } = await prepareGaslessRun({
      ...args,
      requiredRoles: ['holder'],
    });

    info(
      `Submitting gasless transfer of holder for tokenId ${args.tokenId} to ${args.newHolder}. Gas is sponsored by the PlatformPaymaster — no ETH is required from your wallet.`,
    );

    const transactionHash = await transferHolderGasless(
      { titleEscrowAddress },
      smartAccountClient,
      { holderAddress: args.newHolder, remarks: args.remark },
      { id: args.encryptionKey },
    );

    success(
      `Transferable record with tokenId ${args.tokenId}'s holder has been successfully changed to holder with address: ${args.newHolder}`,
    );
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${transactionHash}`);

    return transactionHash;
  } catch (e) {
    error(redactPimlicoApiKey(getErrorMessage(e)));
  }
};
