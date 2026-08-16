import { error, info, success } from 'signale';
import { transferOwnersGasless } from '@trustvc/trustvc';
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
import { TitleEscrowTransferOwnersGaslessCommand } from '../types';

/** Prompt for all inputs needed to gaslessly transfer both the owner and holder of a transferable record. */
export const promptForGaslessTransferOwnersInputs =
  async (): Promise<TitleEscrowTransferOwnersGaslessCommand> => {
    const document = await promptAndReadDocument();
    await verifyDocumentSignature(document);

    const { tokenRegistry, tokenId, network, documentId, registryVersion } =
      await extractDocumentInfo(document);
    assertGaslessSupportedNetwork(network);

    const newOwner = await promptAddress('new owner', 'new beneficiary');
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
      newOwner: newOwner as string,
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
 * Runs a gasless owner+holder transfer end to end: resolves the title escrow, recovers the
 * caller's raw private key, checks the account is eligible for sponsorship, then submits the
 * sponsored UserOperation via @trustvc/trustvc's `transferOwnersGasless`.
 */
export const runTransferOwnersGasless = async (
  args: TitleEscrowTransferOwnersGaslessCommand,
): Promise<string | undefined> => {
  try {
    // Validates remark length up front; the encrypted value returned here is unused because
    // transferOwnersGasless() re-derives and encrypts the remark itself from the raw string.
    validateAndEncryptRemark(args.remark, args.encryptionKey);

    info(
      `Resolving title escrow for tokenId ${args.tokenId} on registry ${args.tokenRegistryAddress}`,
    );
    // Requires the caller to currently be both the holder and the beneficiary (mirrors the non-gasless flow).
    const { network, titleEscrowAddress, smartAccountClient } = await prepareGaslessRun({
      ...args,
      requiredRoles: ['holder', 'beneficiary'],
    });

    info(
      `Submitting gasless transfer of owner and holder for tokenId ${args.tokenId} to new owner at ${args.newOwner} and new holder at ${args.newHolder}. Gas is sponsored by the PlatformPaymaster — no ETH is required from your wallet.`,
    );

    const transactionHash = await transferOwnersGasless(
      { titleEscrowAddress },
      smartAccountClient,
      {
        newBeneficiaryAddress: args.newOwner,
        newHolderAddress: args.newHolder,
        remarks: args.remark,
      },
      { id: args.encryptionKey },
    );

    success(
      `Transferable record with tokenId ${args.tokenId}'s holder has been successfully endorsed to new owner with address ${args.newOwner} and new holder with address: ${args.newHolder}`,
    );
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${transactionHash}`);

    return transactionHash;
  } catch (e) {
    error(redactPimlicoApiKey(getErrorMessage(e)));
  }
};
