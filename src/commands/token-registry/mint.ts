import signale, { error, info, success } from 'signale';
import { TokenRegistryMintCommand } from '../../types';
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
  extractDocumentInfo,
  promptAndReadDocument,
  promptRemark,
  promptAddress,
  performDryRunWithConfirmation,
} from '../../utils';
import { connectToTokenRegistry, validateAndEncryptRemark } from '../helpers';
import { TransactionReceipt } from 'ethers';
import { mint } from '@trustvc/trustvc';

export const command = 'mint';

export const describe = 'Mint a hash to a token registry deployed on the blockchain';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await mintToken(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<TokenRegistryMintCommand> => {
  // Extract document information using utility function
  const document = await promptAndReadDocument();

  // Extract document information using utility function
  const { tokenRegistry, tokenId, network, documentId, registryVersion } =
    await extractDocumentInfo(document);

  // Beneficiary Address
  const beneficiary = await promptAddress('beneficiary', 'initial recipient');

  // Holder Address
  const holder = await promptAddress('holder', 'initial holder');

  // Wallet selection
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

  // Optional: Remark (only for V5)
  const remark = await promptRemark(registryVersion);

  // Use document ID as encryption key
  const encryptionKey = documentId;

  // Build the result object with proper typing
  const baseResult = {
    network,
    address: tokenRegistry,
    tokenId,
    beneficiary,
    holder,
    remark,
    encryptionKey,
    maxPriorityFeePerGasScale: 1,
  };

  // Add wallet-specific properties based on selected wallet type
  if (encryptedWalletPath) {
    return {
      ...baseResult,
      encryptedWalletPath,
    } as TokenRegistryMintCommand;
  } else if (keyFile) {
    return {
      ...baseResult,
      keyFile,
    } as TokenRegistryMintCommand;
  } else if (key) {
    return {
      ...baseResult,
      key,
    } as TokenRegistryMintCommand;
  }

  // For environment variable case (when all wallet options are undefined)
  return baseResult as TokenRegistryMintCommand;
};

// Mint the token with the provided inputs
export const mintToken = async (args: TokenRegistryMintCommand) => {
  try {
    info(
      `Issuing ${args.tokenId} to the initial recipient ${args.beneficiary} and initial holder ${args.holder} in the registry ${args.address}`,
    );

    const transaction = await mintToTokenRegistry({
      ...args,
      tokenId: addAddressPrefix(args.tokenId),
    });

    const network = args.network as NetworkCmdName;

    displayTransactionPrice(transaction as any, network);
    const { hash: transactionHash } = transaction;

    success(
      `Token with hash ${args.tokenId} has been minted on ${args.address} with the initial recipient being ${args.beneficiary} and initial holder ${args.holder}`,
    );
    info(
      `Find more details at ${getEtherscanAddress({ network: args.network })}/tx/${transactionHash}`,
    );

    return args.address;
  } catch (e) {
    error(getErrorMessage(e));
  }
};

const mintToTokenRegistry = async ({
  address,
  beneficiary,
  holder,
  tokenId,
  remark,
  encryptionKey,
  network,
  ...rest
}: TokenRegistryMintCommand): Promise<TransactionReceipt> => {
  const wallet = await getWalletOrSigner({ network, ...rest });

  // Automatic dry run for Ethereum and Polygon networks
  const shouldProceed = await performDryRunWithConfirmation({
    network,
    getTransactionCallback: async () => {
      const tokenRegistry = await connectToTokenRegistry({ address, wallet });
      
      // Validate and encrypt the remark with document ID as encryption key
      const encryptedRemark = validateAndEncryptRemark(remark, encryptionKey);
      
      // Populate the transaction for gas estimation
      const tx = await tokenRegistry.mint.populateTransaction(
        beneficiary,
        holder,
        tokenId,
        encryptedRemark
      );
      
      // Ensure the transaction has a 'from' address for proper gas estimation
      return {
        ...tx,
        from: await wallet.getAddress(),
      };
    },
  });

  if (!shouldProceed) {
    process.exit(0);
  }

  let transaction;

  // Execute transaction with appropriate gas settings based on network capabilities
  if (canEstimateGasPrice(network)) {
    // Ensure provider is available for gas estimation
    if (!wallet.provider) {
      throw new Error('Provider is required for gas estimation');
    }

    // Get current gas fees from the network
    const gasFees = await getGasFees({ provider: wallet.provider, ...rest });

    // Execute mint with EIP-1559 gas parameters
    transaction = await mint(
      { tokenRegistryAddress: address },
      wallet,
      { beneficiaryAddress: beneficiary, holderAddress: holder, tokenId, remarks: remark },
      {
        id: encryptionKey,
        maxFeePerGas: gasFees.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas?.toString(),
      },
    );
  } else {
    // Execute mint without gas estimation (for networks that don't support it)
    transaction = await mint(
      { tokenRegistryAddress: address },
      wallet,
      { beneficiaryAddress: beneficiary, holderAddress: holder, tokenId, remarks: remark },
      {
        id: encryptionKey,
      },
    );
  }

  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  const receipt = (await transaction.wait()) as unknown as TransactionReceipt;
  if (!receipt) {
    throw new Error('Transaction receipt not found');
  }
  return receipt;
};
