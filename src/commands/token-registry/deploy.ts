import { error, info, success } from 'signale';
import { CHAIN_ID, deployTokenRegistry, v5Utils, v5ContractAddress } from '@trustvc/trustvc';
import { input, confirm } from '@inquirer/prompts';
import {
  displayTransactionPrice,
  getErrorMessage,
  getEtherscanAddress,
  NetworkCmdName,
  promptWalletSelection,
  promptNetworkSelection,
  getWalletOrSigner,
  getSupportedNetwork,
  performDryRunWithConfirmation,
  promptAddress,
  supportedNetwork,
} from '../../utils';
import {
  connectToTDocDeployerContract,
  connectToTradeTrustTokenFactory,
  waitForTransaction,
} from '../helpers';
import { TransactionReceipt, Provider } from 'ethers';

export const command = 'deploy';

export const describe = 'Deploys a document store contract on the blockchain';

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;

    await deployTokenRegistryContract(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

// Define the command type
type DeployTokenRegistryCommand = {
  registryName: string;
  registrySymbol: string;
  standalone: boolean;
  factoryAddress?: string;
  tokenRegistryImplAddress?: string;
  deployerContractAddress?: string;
  network: string;
  owner: string;
  encryptedWalletPath?: string;
  key?: string;
  keyFile?: string;
  maxPriorityFeePerGasScale: number;
};

// Prompt user for all required inputs
export const promptForInputs = async (): Promise<DeployTokenRegistryCommand> => {
  // Network selection
  const network = await promptNetworkSelection();

  // Registry name
  const registryName = await input({
    message: 'Enter the name of the token registry:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Registry name is required';
      }
      return true;
    },
  });

  // Registry symbol
  const registrySymbol = await input({
    message: 'Enter the symbol of the token registry:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') {
        return 'Registry symbol is required';
      }
      return true;
    },
  });

  // Ask if standalone or not (true = standalone, false = factory deployment)
  const standalone = await confirm({
    message: 'Is this a standalone deployment?',
    default: true,
  });

  // Conditionally prompt for addresses based on deployment type
  let factoryAddress: string | undefined;
  let tokenRegistryImplAddress: string | undefined;
  let deployerContractAddress: string | undefined;

  if (standalone) {
    // Standalone deployment: only ask for factory address
    factoryAddress = await promptAddress('factory', 'optional', true);
  } else {
    // Factory deployment: ask for implementation and deployer contract addresses
    tokenRegistryImplAddress = await promptAddress(
      'token registry implementation',
      'optional',
      true,
    );
    deployerContractAddress = await promptAddress('deployer contract', 'optional', true);
  }

  // Wallet selection
  const { encryptedWalletPath, key, keyFile } = await promptWalletSelection();

  // Build the result object with proper typing
  const baseResult = {
    network,
    registryName,
    registrySymbol,
    factoryAddress,
    tokenRegistryImplAddress,
    deployerContractAddress,
    standalone,
    maxPriorityFeePerGasScale: 1,
  };

  // Add wallet-specific properties based on selected wallet type
  if (encryptedWalletPath) {
    return {
      ...baseResult,
      encryptedWalletPath,
    } as DeployTokenRegistryCommand;
  } else if (keyFile) {
    return {
      ...baseResult,
      keyFile,
    } as DeployTokenRegistryCommand;
  } else if (key) {
    return {
      ...baseResult,
      key,
    } as DeployTokenRegistryCommand;
  }

  // For environment variable case (when all wallet options are undefined)
  return baseResult as DeployTokenRegistryCommand;
};

// Deploy the document store with the provided inputs
export const deployTokenRegistryContract = async ({
  network,
  registryName,
  registrySymbol,
  standalone,
  factoryAddress,
  tokenRegistryImplAddress,
  deployerContractAddress,
  ...rest
}: DeployTokenRegistryCommand) => {
  try {
    const wallet = await getWalletOrSigner({ network, ...rest });
    const chainId = supportedNetwork[network as NetworkCmdName].networkId;

    const { TitleEscrowFactory, TokenImplementation, Deployer } = v5ContractAddress;
    const defaultTitleEscrowFactoryAddress = TitleEscrowFactory[chainId];
    const defaultTokenImplementationContractAddress = TokenImplementation[chainId];
    const defaultDeployerContractAddress = Deployer[chainId];

    // Use new variables to avoid reassigning destructured parameters
    const finalDeployerContractAddress = deployerContractAddress ?? defaultDeployerContractAddress;
    const finalFactoryAddress = factoryAddress ?? defaultTitleEscrowFactoryAddress;
    const finalTokenRegistryImplAddress =
      tokenRegistryImplAddress ?? defaultTokenImplementationContractAddress;

    // Automatic dry run for Ethereum and Polygon networks
    const shouldProceed = await performDryRunWithConfirmation({
      network,
      getTransactionCallback: async () => {
        let tx;

        if (!standalone) {
          const tDocDeployer = await connectToTDocDeployerContract({
            tDocDeployerContractAddress: finalDeployerContractAddress,
            wallet: wallet,
          });
          const initParam = v5Utils.encodeInitParams({
            name: registryName,
            symbol: registrySymbol,
            deployer: await wallet.getAddress(),
          });
          // Populate the transaction for gas estimation
          tx = await tDocDeployer.deploy.populateTransaction(
            finalTokenRegistryImplAddress,
            initParam,
          );
        } else {
          const tradeTrustTokenFactory = await connectToTradeTrustTokenFactory();
          // Populate the transaction for gas estimation
          tx = await tradeTrustTokenFactory.getDeployTransaction(
            registryName,
            registrySymbol,
            finalFactoryAddress,
          );
        }

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

    info(`Deploying token registry ${registryName}`);

    const transaction = await deployTokenRegistry(registryName, registrySymbol, wallet, {
      chainId: getSupportedNetwork(network).networkId as unknown as CHAIN_ID,
      standalone,
      factoryAddress: finalFactoryAddress,
      tokenRegistryImplAddress: finalTokenRegistryImplAddress,
      deployerContractAddress: finalDeployerContractAddress,
    });

    const receipt = standalone
      ? transaction
      : await waitForTransaction(transaction, wallet.provider as Provider);

    displayTransactionPrice(receipt, network as NetworkCmdName);

    const { hash } = receipt as unknown as TransactionReceipt;
    let contractAddress = receipt.contractAddress;
    // Extract the deployed token registry address from the logs
    // When a contract is deployed via factory, the first logs are emitted by the newly deployed contract
    // during its initialization. The first log's address is the deployed contract address.
    if (!contractAddress) {
      if (receipt.logs && receipt.logs.length > 0) {
        // Get the address from the first log - this is the deployed contract
        contractAddress = receipt.logs[0].address;
      }
    }

    if (!contractAddress) {
      error('Failed to extract deployed token registry address from transaction receipt');
      return null;
    }

    success(`Token registry ${registryName} deployed at ${contractAddress}`);
    info(`Find more details at ${getEtherscanAddress({ network: network })}/tx/${hash}`);

    return contractAddress;
  } catch (e) {
    console.log(e);
    error(getErrorMessage(e));
  }
};
