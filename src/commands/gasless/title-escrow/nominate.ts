import { error, info, success } from 'signale';
import { nominateGasless } from '@trustvc/trustvc';
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
import { TitleEscrowNominateBeneficiaryGaslessCommand } from '../types';

/** Prompt for all inputs needed to gaslessly nominate a new beneficiary for a transferable record. */
export const promptForGaslessNominateInputs =
  async (): Promise<TitleEscrowNominateBeneficiaryGaslessCommand> => {
    const document = await promptAndReadDocument();
    await verifyDocumentSignature(document);

    const { tokenRegistry, tokenId, network, documentId, registryVersion } =
      await extractDocumentInfo(document);
    assertGaslessSupportedNetwork(network);

    const newBeneficiary = await promptAddress('beneficiary', 'new beneficiary (owner)');
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
      newBeneficiary: newBeneficiary as string,
      paymasterAddress: paymasterAddress as string,
      remark,
      encryptionKey: documentId,
      encryptedWalletPath,
      key,
      keyFile,
    };
  };

/**
 * Runs a gasless beneficiary nomination end to end: resolves the title escrow, recovers the
 * caller's raw private key, checks the account is eligible for sponsorship, then submits the
 * sponsored UserOperation via @trustvc/trustvc's `nominateGasless`.
 */
export const runNominateGasless = async (
  args: TitleEscrowNominateBeneficiaryGaslessCommand,
): Promise<string | undefined> => {
  try {
    // Validates remark length up front; the encrypted value returned here is unused because
    // nominateGasless() re-derives and encrypts the remark itself from the raw string.
    validateAndEncryptRemark(args.remark, args.encryptionKey);

    info(
      `Resolving title escrow for tokenId ${args.tokenId} on registry ${args.tokenRegistryAddress}`,
    );
    // Nominating requires the caller to currently be the beneficiary (mirrors the non-gasless flow).
    const { network, titleEscrowAddress, smartAccountClient } = await prepareGaslessRun({
      ...args,
      requiredRoles: ['beneficiary'],
    });

    info(
      `Submitting gasless nomination for tokenId ${args.tokenId} to new owner at ${args.newBeneficiary}. Gas is sponsored by the PlatformPaymaster — no ETH is required from your wallet.`,
    );

    const transactionHash = await nominateGasless(
      { titleEscrowAddress },
      smartAccountClient,
      { newBeneficiaryAddress: args.newBeneficiary, remarks: args.remark },
      { id: args.encryptionKey },
    );

    success(
      `Transferable record with tokenId ${args.tokenId}'s holder has been successfully nominated to new owner with address ${args.newBeneficiary}`,
    );
    info(`Find more details at ${getEtherscanAddress({ network })}/tx/${transactionHash}`);

    return transactionHash;
  } catch (e) {
    error(getErrorMessage(e));
  }
};
