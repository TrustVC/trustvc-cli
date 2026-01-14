import { BigNumberish, Overrides, Provider, formatEther } from 'ethers';
import { info } from 'signale';
import fetch, { RequestInit } from 'node-fetch';
import { GasPriceScale } from './cli-options';
import type { GasStationFeeData } from './gas-station';
import {
  NetworkCmdName,
  getSupportedNetwork,
  getSupportedNetworkNameFromId,
  supportedNetwork,
} from './networks';

// TransactionReceipt
export interface TransactionReceiptFees {
  effectiveGasPrice: BigNumberish;
  gasUsed: BigNumberish;
  transactionHash?: string;
  hash?: string;
}

export const scaleBigNumber = (
  wei: BigNumberish | null | undefined,
  multiplier: number,
  precision = 2,
): bigint => {
  if (wei === null || typeof wei === 'undefined') {
    throw new Error('Wei not specified');
  }
  const padding = Math.pow(10, precision);
  const newMultiplier = Math.round(padding * multiplier);
  const weiBigInt = BigInt(wei.toString());

  const newWei = (weiBigInt * BigInt(newMultiplier)) / BigInt(padding);
  return newWei;
};

interface GetGasFeesArgs extends GasPriceScale {
  provider: Provider;
}

export const getGasFees = async ({
  provider,
  maxPriorityFeePerGasScale,
}: GetGasFeesArgs): Promise<Overrides> => {
  const feeData = await getFeeData(provider);
  const { maxFeePerGas, maxPriorityFeePerGas } = feeData;
  return {
    maxPriorityFeePerGas: scaleBigNumber(maxPriorityFeePerGas, maxPriorityFeePerGasScale),
    maxFeePerGas: calculateMaxFee(maxFeePerGas, maxPriorityFeePerGas, maxPriorityFeePerGasScale),
  };
};

export const getFeeData = async (provider: Provider): Promise<GasStationFeeData> => {
  const network = await provider.getNetwork();
  const networkName = getSupportedNetworkNameFromId(Number(network.chainId));
  const gasStation = getSupportedNetwork(networkName)?.gasStation;

  const feeData = gasStation && (await gasStation());

  return feeData || (await provider.getFeeData());
};

export const calculateMaxFee = (
  maxFee: BigNumberish | null | undefined,
  priorityFee: BigNumberish | null | undefined,
  scale: number,
): bigint => {
  if (maxFee === null || typeof maxFee === 'undefined') {
    throw new Error('Max Fee not specified');
  }
  if (priorityFee === null || typeof priorityFee === 'undefined') {
    throw new Error('Priority Fee not specified');
  }
  if (scale === 1) {
    return BigInt(maxFee.toString());
  }
  const priorityFeeBigInt = BigInt(priorityFee.toString());
  const maxFeeBigInt = BigInt(maxFee.toString());
  const priorityFeeChange = scaleBigNumber(priorityFee, scale) - priorityFeeBigInt;
  return maxFeeBigInt + priorityFeeChange;
};

export const canEstimateGasPrice = (network: string): boolean => {
  if (
    network === NetworkCmdName.XDC ||
    network === NetworkCmdName.XDCApothem ||
    network === NetworkCmdName.Astron ||
    network === NetworkCmdName.AstronTestnet
  ) {
    return false;
  }
  return true;
};

export const displayTransactionPrice = async (
  transaction: TransactionReceiptFees,
  network: NetworkCmdName,
): Promise<void> => {
  // workaround for issue in XDC that unable to get gas fee after transaction
  if (
    network === NetworkCmdName.XDC ||
    network === NetworkCmdName.XDCApothem ||
    network === NetworkCmdName.StabilityTestnet ||
    network === NetworkCmdName.Stability ||
    network === NetworkCmdName.Astron ||
    network === NetworkCmdName.AstronTestnet
  ) {
    return;
  }

  // Check if gas data is available (effectiveGasPrice or gasPrice)
  const gasPrice = (transaction as any).effectiveGasPrice || (transaction as any).gasPrice;
  if (!gasPrice || !transaction.gasUsed) {
    return;
  }

  const currency = supportedNetwork[network].currency;
  const effectiveGasPrice = BigInt(gasPrice.toString());
  const gasUsed = BigInt(transaction.gasUsed.toString());
  const totalWEI = effectiveGasPrice * gasUsed;
  const spotRate = await getSpotRate(currency, 'USD');
  const totalUSD = convertWeiFiatDollars(totalWEI, spotRate);

  info(`Transaction fee of ${formatEther(totalWEI)} ${currency} / ~ ${currency}-USD ${totalUSD}`);
};

export const request = (url: string, options?: RequestInit): Promise<any> => {
  return fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`unexpected response ${response.statusText}`);
      }
      return response;
    })
    .then((response) => response.json());
};

export const getSpotRate = async (
  crypto_currency = 'ETH',
  fiat_currency = 'USD',
): Promise<number> => {
  const URL = `https://api.coinbase.com/v2/prices/${crypto_currency}-${fiat_currency}/spot`;
  const spotRate = (await request(URL)).data.amount;
  return spotRate;
};

// Minimally precision of 2 to get precision of 1 cent
export const convertWeiFiatDollars = (
  cost: BigNumberish,
  spotRate: number,
  precision = 5,
): number => {
  const padding = Math.pow(10, precision);
  const spotRateCents = Math.ceil(spotRate * padding); // Higher better than lower
  const costBigInt = BigInt(cost.toString());
  const costInWeiFiatCents = costBigInt * BigInt(spotRateCents);
  const WeiPerEther = 1000000000000000000n; // 10^18
  const costInFiatDollars = Number(costInWeiFiatCents / WeiPerEther / BigInt(padding)); // Fiat Dollar
  const costInFiatCents = Number((costInWeiFiatCents / WeiPerEther) % BigInt(padding)) / padding; /// Fiat Cents
  return costInFiatDollars + costInFiatCents;
};
