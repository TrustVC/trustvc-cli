import { error, info, success } from 'signale';
import { returnToIssuerGasless } from '@trustvc/trustvc';
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
import { prepareGaslessRun } from '../common';
import { TitleEscrowReturnDocumentGaslessCommand } from '../types';

/** Prompt for all inputs needed to gaslessly return a transferable record to the issuer. */
export const promptForGaslessReturnToIssuerInputs =
  async (): Promise<TitleEscrowReturnDocumentGaslessCommand> => {
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
 * Runs a gasless return-to-issuer transaction end to end: resolves the title escrow, recovers the
 * caller's raw private key, checks the account is eligible for sponsorship, then submits the
 * sponsored UserOperation via @trustvc/trustvc's `returnToIssuerGasless`.
 */
export const runReturnToIssuerGasless = async (
  args: TitleEscrowReturnDocumentGaslessCommand,
): Promise<string | undefined> => {
  try {
    // Validates remark length up front; the encrypted value returned here is unused because
    // returnToIssuerGasless() re-derives and encrypts the remark itself from the raw string.
    validateAndEncryptRemark(args.remark, args.encryptionKey);

    info(
      `Resolving title escrow for tokenId ${args.tokenId} on registry ${args.tokenRegistryAddress}`,
    );
    // Returning to the issuer requires the caller to currently be both the holder and beneficiary.
    const { network, titleEscrowAddress, smartAccountClient } = await prepareGaslessRun({
      ...args,
      requiredRoles: ['holder', 'beneficiary'],
    });

    info(
      `Submitting gasless return to issuer for tokenId ${args.tokenId}. Gas is sponsored by the PlatformPaymaster — no ETH is required from your wallet.`,
    );

    const transactionHash = await returnToIssuerGasless(
      { titleEscrowAddress },
      smartAccountClient,
      { remarks: args.remark },
      { id: args.encryptionKey },
    );

    success(`Transferable record with tokenId ${args.tokenId} has been returned.`);
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${transactionHash}`);

    return transactionHash;
  } catch (e) {
    error(getErrorMessage(e));
  }
};
