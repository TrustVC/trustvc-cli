import { TransactionReceipt } from '@ethersproject/providers';
import { input, select } from '@inquirer/prompts';
import { mint } from '@trustvc/trustvc';
import { BigNumber } from 'ethers';
import { error, info, success } from 'signale';
import { Argv } from 'yargs';
import { TokenRegistryMintCommand } from '../../types';
import {
  addAddressPrefix,
  canEstimateGasPrice,
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  getGasFees,
  NetworkCmdName,
} from '../../utils';
import { getWalletOrSigner } from '../../utils/wallet';

export const command = 'token-registry <method>';

export const describe = 'Invoke a function over a token registry smart contract on the blockchain';

export const builder = (yargs: Argv): Argv =>
  yargs.command({
    command: 'mint',
    describe: 'Mint a hash to a token registry deployed on the blockchain',
    handler: mintHandler,
  });

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
  const network = await select({
    message: 'Select the network:',
    choices: [
      { name: 'Local', value: NetworkCmdName.Local },
      { name: 'Ethereum Mainnet', value: NetworkCmdName.Mainnet },
      { name: 'Sepolia Testnet', value: NetworkCmdName.Sepolia },
      { name: 'Polygon Mainnet', value: NetworkCmdName.Matic },
      { name: 'Polygon Amoy Testnet', value: NetworkCmdName.Amoy },
      { name: 'XDC Network', value: NetworkCmdName.XDC },
      { name: 'XDC Apothem Testnet', value: NetworkCmdName.XDCApothem },
      { name: 'Stability Testnet', value: NetworkCmdName.StabilityTestnet },
      { name: 'Stability Mainnet', value: NetworkCmdName.Stability },
      { name: 'Astron', value: NetworkCmdName.Astron },
      { name: 'Astron Testnet', value: NetworkCmdName.AstronTestnet },
    ],
    default: NetworkCmdName.Sepolia,
  });

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

  // Wallet option
  const walletOption = await select({
    message: 'Select wallet/private key option:',
    choices: [
      {
        name: 'Encrypted wallet file (recommended)',
        value: 'encryptedWallet',
        description: 'Path to an encrypted wallet JSON file',
      },
      {
        name: 'Environment variable (OA_PRIVATE_KEY)',
        value: 'envVariable',
        description: 'Use private key from OA_PRIVATE_KEY environment variable',
      },
      {
        name: 'Private key file',
        value: 'keyFile',
        description: 'Path to a file containing the private key',
      },
      {
        name: 'Private key directly',
        value: 'keyDirect',
        description: 'Provide private key directly (will be stored in bash history)',
      },
    ],
    default: 'encryptedWallet',
  });

  let encryptedWalletPath: string | undefined;
  let key: string | undefined;
  let keyFile: string | undefined;

  if (walletOption === 'encryptedWallet') {
    encryptedWalletPath = await input({
      message: 'Enter the path to your encrypted wallet JSON file:',
      default: './wallet.json',
      required: true,
    });
  } else if (walletOption === 'envVariable') {
    // Check if OA_PRIVATE_KEY is set
    if (!process.env.OA_PRIVATE_KEY) {
      throw new Error(
        'OA_PRIVATE_KEY environment variable is not set. Please set it or choose another option.',
      );
    }
    info('Using private key from OA_PRIVATE_KEY environment variable');
    // The key will be picked up automatically by getPrivateKey in wallet.ts
  } else if (walletOption === 'keyFile') {
    keyFile = await input({
      message: 'Enter the path to your private key file:',
      required: true,
    });
  } else if (walletOption === 'keyDirect') {
    key = await input({
      message: 'Enter your private key:',
      required: true,
    });
  }

  // Optional: Remark
  const remark = await input({
    message: 'Enter a remark for the minting (optional):',
    required: false,
  });

  // Optional: Encryption Key (only if remark is provided)
  let encryptionKey: string | undefined;
  if (remark && remark.trim() !== '') {
    encryptionKey = await input({
      message: 'Enter an encryption key for the document (optional):',
      required: false,
    });
  }

  // Build the result object with proper typing
  const baseResult = {
    network,
    address,
    tokenId,
    beneficiary,
    holder,
    remark: remark || undefined,
    encryptionKey: encryptionKey || undefined,
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
  } else if (walletOption === 'envVariable') {
    // For environment variable, return base result without key/keyFile
    // The getPrivateKey function will pick it up from process.env.OA_PRIVATE_KEY
    return baseResult as TokenRegistryMintCommand;
  }

  throw new Error('No wallet option selected');
};

// Mint the token with the provided inputs
export const mintToken = async (args: TokenRegistryMintCommand) => {
  try {
    info(
      `Issuing ${args.tokenId} to the initial recipient ${args.beneficiary} and initial holder ${args.holder} in the registry ${args.address}`,
    );

    // Execute the minting transaction
    const transaction = await executeMint(args);

    const network = args.network as NetworkCmdName;
    displayTransactionPrice(transaction, network);
    const { transactionHash } = transaction;

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

// Execute the blockchain minting transaction
const executeMint = async ({
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
  let transactionOptions: { maxFeePerGas?: BigNumber; maxPriorityFeePerGas?: BigNumber } = {};

  if (dryRun) {
    console.log('🔧 Dry run mode is currently undergoing upgrades and will be available soon.');
    process.exit(0);
  }

  if (canEstimateGasPrice(network)) {
    const gasFees = await getGasFees({ provider: wallet.provider, ...rest });
    transactionOptions = {
      maxFeePerGas: gasFees.maxFeePerGas as BigNumber,
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas as BigNumber,
    };
  }

  const transaction = await mint(
    { tokenRegistryAddress: address },
    wallet,
    {
      beneficiaryAddress: beneficiary,
      holderAddress: holder,
      tokenId: addAddressPrefix(tokenId),
      remarks: remark,
    },
    { id: encryptionKey, ...transactionOptions },
  );
  info(`Waiting for transaction ${transaction.hash} to be mined`);
  return transaction.wait();
};
