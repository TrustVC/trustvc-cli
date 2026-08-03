import signale, { error, info, success } from 'signale';
import { ObligationRegistryMintCommand } from '../../types';
import {
  addAddressPrefix,
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptWalletSelection,
  getWalletOrSigner,
  canEstimateGasPrice,
  getGasFees,
  extractObligationDocumentInfo,
  promptAndReadDocument,
  promptRemark,
  promptAddress,
  performDryRunWithConfirmation,
  verifyDocumentSignature,
} from '../../utils';
import { connectToObligationRegistry, validateAndEncryptRemark } from '../helpers';
import { TransactionReceipt } from 'ethers';
import { mintObligationRegistry } from '@trustvc/trustvc';

export const command = 'mint';

export const describe = 'Mint a tokenId to an Obligation Registry deployed on the blockchain';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await mintObligationToken(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
};

export const promptForInputs = async (): Promise<ObligationRegistryMintCommand> => {
  const document = await promptAndReadDocument();
  await verifyDocumentSignature(document);

  const { obligationRegistry, tokenId, network, documentId } =
    await extractObligationDocumentInfo(document);

  const beneficiary = await promptAddress('beneficiary', 'initial recipient');
  const holder = await promptAddress('holder', 'initial holder');
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();
  const remark = await promptRemark('v5');
  const encryptionKey = documentId;

  const baseResult = {
    network,
    address: obligationRegistry,
    tokenId,
    beneficiary,
    holder,
    remark,
    encryptionKey,
    maxPriorityFeePerGasScale: 1,
  };

  if (encryptedWalletPath) {
    return { ...baseResult, encryptedWalletPath } as ObligationRegistryMintCommand;
  }
  if (keyFile) {
    return { ...baseResult, keyFile } as ObligationRegistryMintCommand;
  }
  if (key) {
    return { ...baseResult, key } as ObligationRegistryMintCommand;
  }
  return baseResult as ObligationRegistryMintCommand;
};

export const mintObligationToken = async (args: ObligationRegistryMintCommand) => {
  try {
    info(
      `Issuing ${args.tokenId} to recipient ${args.beneficiary} and holder ${args.holder} in obligation registry ${args.address}`,
    );

    const transaction = await mintToObligationRegistry({
      ...args,
      tokenId: addAddressPrefix(args.tokenId),
    });
    if (!transaction) return;

    displayTransactionPrice(transaction as any, args.network as NetworkCmdName);
    success(
      `Token ${args.tokenId} minted on obligation registry ${args.address} (beneficiary ${args.beneficiary}, holder ${args.holder})`,
    );
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transaction.hash}`,
    );
    return args.address;
  } catch (e) {
    error(getErrorMessage(e));
    process.exitCode = 1;
  }
};

const mintToObligationRegistry = async ({
  address,
  beneficiary,
  holder,
  tokenId,
  remark,
  encryptionKey,
  network,
  ...rest
}: ObligationRegistryMintCommand): Promise<TransactionReceipt | null> => {
  const wallet = await getWalletOrSigner({ network, ...rest });

  const shouldProceed = await performDryRunWithConfirmation({
    network,
    getTransactionCallback: async () => {
      const registry = await connectToObligationRegistry({ address, wallet });
      const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);
      const tx = await registry.mint.populateTransaction(
        beneficiary,
        holder,
        tokenId,
        encryptedRemark,
      );
      return { ...tx, from: await wallet.getAddress() };
    },
  });

  // null = definitive dry-run revert; false = user cancel — do not process.exit(0)
  if (shouldProceed === null) {
    process.exitCode = 1;
    return null;
  }
  if (!shouldProceed) {
    throw new Error('Mint transaction was not submitted.');
  }

  let transaction;
  if (canEstimateGasPrice(network)) {
    if (!wallet.provider) {
      throw new Error('Provider is required for gas estimation');
    }
    const gasFees = await getGasFees({ provider: wallet.provider, ...rest });
    transaction = await mintObligationRegistry(
      { obligationRegistryAddress: address },
      wallet,
      { beneficiaryAddress: beneficiary, holderAddress: holder, tokenId, remarks: remark },
      {
        id: encryptionKey,
        maxFeePerGas: gasFees.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
      },
    );
  } else {
    transaction = await mintObligationRegistry(
      { obligationRegistryAddress: address },
      wallet,
      { beneficiaryAddress: beneficiary, holderAddress: holder, tokenId, remarks: remark },
      { id: encryptionKey },
    );
  }

  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  const receipt = (await transaction.wait()) as unknown as TransactionReceipt;
  if (!receipt) {
    throw new Error('Transaction receipt not found');
  }
  return receipt;
};
