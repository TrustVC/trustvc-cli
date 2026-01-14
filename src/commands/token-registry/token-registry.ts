import { input } from '@inquirer/prompts';
import signale, { error, info, success } from 'signale';
import { TokenRegistryMintCommand } from '../../types';
import {
  addAddressPrefix,
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptRemarkAndEncryptionKey,
  promptNetworkSelection,
  promptWalletSelection,
  getWalletOrSigner,
  canEstimateGasPrice,
  getGasFees,
} from '../../utils';
import { BigNumberish, TransactionReceipt } from 'ethers';
import { mint } from '@trustvc/trustvc';
export const command = 'token-registry <method>';

export const describe = 'Invoke a function over a token registry smart contract on the blockchain';

export const handler = (): void => {
  error('Invalid or missing method. Available methods: mint');
  process.exit(1);
};

export const mintHandler = async (): Promise<void> => {
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
  // Network selection
  const network = await promptNetworkSelection();

  // Token Registry Address
  const address = await input({
    message: 'Enter the token registry contract address:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Token registry address is required';
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
        return 'Invalid Ethereum address format';
      }
      return true;
    },
  });

  // Token ID (Document Hash)
  const tokenId = await input({
    message: 'Enter the document hash (tokenId) to mint:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Token ID is required';
      }
      return true;
    },
  });

  // Beneficiary Address
  const beneficiary = await input({
    message: 'Enter the beneficiary address (initial recipient):',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Beneficiary address is required';
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
        return 'Invalid Ethereum address format';
      }
      return true;
    },
  });

  // Holder Address
  const holder = await input({
    message: 'Enter the holder address (initial holder):',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Holder address is required';
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
        return 'Invalid Ethereum address format';
      }
      return true;
    },
  });

  // Wallet selection
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

  // Optional: Remark and Encryption Key
  const { remark, encryptionKey } = await promptRemarkAndEncryptionKey();

  // Build the result object with proper typing
  const baseResult = {
    network,
    address,
    tokenId,
    beneficiary,
    holder,
    remark,
    encryptionKey,
    dryRun: false,
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
  dryRun,
  ...rest
}: TokenRegistryMintCommand): Promise<TransactionReceipt> => {
  const wallet = await getWalletOrSigner({ network, ...rest });
  let transactionOptions: { maxFeePerGas?: BigNumberish; maxPriorityFeePerGas?: BigNumberish } = {};

  if (dryRun) {
    console.log('🔧 Dry run mode is currently undergoing upgrades and will be available soon.');
    process.exit(0);
  }

  if (canEstimateGasPrice(network)) {
    if (!wallet.provider) {
      throw new Error('Provider is required for gas estimation');
    }
    const gasFees = await getGasFees({ provider: wallet.provider, ...rest });
    transactionOptions = {
      maxFeePerGas: gasFees.maxFeePerGas as BigNumberish,
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas as BigNumberish,
    };
  }

  const transaction = await mint(
    { tokenRegistryAddress: address },
    wallet,
    { beneficiaryAddress: beneficiary, holderAddress: holder, tokenId, remarks: remark },
    { id: encryptionKey, ...transactionOptions },
  );
  signale.await(`Waiting for transaction ${transaction.hash} to be mined`);
  const receipt = (await transaction.wait()) as unknown as TransactionReceipt;
  if (!receipt) {
    throw new Error('Transaction receipt not found');
  }
  return receipt;
};
