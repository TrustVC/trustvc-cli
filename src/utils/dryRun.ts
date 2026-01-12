import { formatUnits, TransactionRequest } from 'ethers';
import { getSpotRate, green, highlight, red } from '../utils';
import { BigNumberish } from 'ethers';
import { convertWeiFiatDollars } from '../utils';
import { getSupportedNetwork } from '../utils';

export interface FeeDataType {
  maxFeePerGas: BigNumberish | null;
  maxPriorityFeePerGas: BigNumberish | null;
}

export const dryRunMode = async ({
  transaction,
  estimatedGas,
  network,
}: {
  network: string;
  transaction?: TransactionRequest;
  estimatedGas?: BigNumberish;
}): Promise<void> => {
  // estimated gas or a transaction must be provided, if a transaction is provided let's estimate the gas automatically
  // the transaction is run on the provided network
  const provider = getSupportedNetwork(network ?? 'mainnet').provider();
  let _estimatedGas = estimatedGas;
  if (!estimatedGas && transaction) {
    _estimatedGas = await provider.estimateGas(transaction);
  }
  if (!_estimatedGas) {
    throw new Error('Please provide estimatedGas or transaction');
  }

  const blockNumber = await provider.getBlockNumber();
  const feeData = await provider.getFeeData();
  const zero = 0n;
  const { maxFeePerGas, gasPrice, maxPriorityFeePerGas } = {
    maxFeePerGas: feeData.maxFeePerGas ?? zero,
    gasPrice: feeData.gasPrice ?? zero,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? zero,
  };

  const gasCost = gasPrice * BigInt(_estimatedGas.toString());
  const maxCost = maxFeePerGas * BigInt(_estimatedGas.toString());
  const maxPriorityCost = maxPriorityFeePerGas * BigInt(_estimatedGas.toString());

  const spotRateETHUSD = await getSpotRate('ETH', 'USD');
  const spotRateETHSGD = await getSpotRate('ETH', 'SGD');
  const spotRateMATICUSD = await getSpotRate('POL', 'USD');
  const spotRateMATICSGD = await getSpotRate('POL', 'SGD');
  const estimatedFeeUSD = convertWeiFiatDollars(gasCost, spotRateETHUSD);

  console.log(
    red(
      '\n\n/!\\ Welcome to the fee table. Please read the information below to understand the transaction fee',
    ),
  );
  console.log(
    `\nThe table below display information about the cost of the transaction on the mainnet network, depending on the gas price selected. Multiple modes are displayed to help you better help you to choose a gas price depending on your needs:\n`,
  );

  console.log(green('Information about the network:'));
  console.log(`Costs based on block number: ${highlight(blockNumber)}`);
  console.table({
    current: {
      'block number': blockNumber,
      'gas price (gwei)': formatUnits(gasPrice, 'gwei'),
      'max priority fee per gas (gwei)': formatUnits(maxPriorityFeePerGas, 'gwei'),
      'max fee per gas (gwei)': formatUnits(maxFeePerGas, 'gwei'),
    },
  });

  console.log(green('Information about the transaction:'));

  console.log(
    `Estimated gas required: ${highlight(_estimatedGas.toString())} gas, which will cost approximately ${highlight(
      `US$${estimatedFeeUSD}`,
    )} based on prevailing gas price.`,
  );

  console.table({
    GWEI: {
      'gas cost': formatUnits(gasCost, 'gwei'),
      'priority fee price': formatUnits(maxPriorityCost, 'gwei'),
      'max fee price': formatUnits(maxCost, 'gwei'),
    },
    ETH: {
      'gas cost': formatUnits(gasCost, 'ether'),
      'priority fee price': formatUnits(maxPriorityCost, 'ether'),
      'max fee price': formatUnits(maxCost, 'ether'),
    },
    ETHUSD: {
      'gas cost': convertWeiFiatDollars(gasCost, spotRateETHUSD),
      'priority fee price': convertWeiFiatDollars(maxPriorityCost, spotRateETHUSD),
      'max fee price': convertWeiFiatDollars(maxCost, spotRateETHUSD),
    },
    ETHSGD: {
      'gas cost': convertWeiFiatDollars(gasCost, spotRateETHSGD),
      'priority fee price': convertWeiFiatDollars(maxPriorityCost, spotRateETHSGD),
      'max fee price': convertWeiFiatDollars(maxCost, spotRateETHSGD),
    },
    MATICUSD: {
      'gas cost': convertWeiFiatDollars(gasCost, spotRateMATICUSD),
      'priority fee price': convertWeiFiatDollars(maxPriorityCost, spotRateMATICUSD),
      'max fee price': convertWeiFiatDollars(maxCost, spotRateMATICUSD),
    },
    MATICSGD: {
      'gas cost': convertWeiFiatDollars(gasCost, spotRateMATICSGD),
      'priority fee price': convertWeiFiatDollars(maxPriorityCost, spotRateMATICSGD),
      'max fee price': convertWeiFiatDollars(maxCost, spotRateMATICSGD),
    },
  });
  console.log(red('Please read the information above to understand the table'));
};
