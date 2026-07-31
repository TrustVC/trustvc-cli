import { info } from 'signale';
import {
  getObligationRegistryAddress,
  getTokenId,
  getChainId,
  isObligationRecord,
} from '@trustvc/trustvc';
import { SUPPORTED_CHAINS, CHAIN_ID } from './networks';

/**
 * Extracts obligation / BoE document fields. Fails for classic ETR (tokenRegistry-only) docs.
 */
export const extractObligationDocumentInfo = async (
  document: any,
): Promise<{
  document: any;
  obligationRegistry: string;
  tokenId: string;
  network: string;
  documentId: string;
}> => {
  if (!isObligationRecord(document)) {
    throw new Error(
      'Document is not an obligation / BoE record. Use classic token-registry / title-escrow commands for TransferableRecords with tokenRegistry.',
    );
  }

  let obligationRegistry: string | undefined;
  let tokenId: string | undefined;
  let chainId: CHAIN_ID | undefined;

  try {
    obligationRegistry = getObligationRegistryAddress(document);
    tokenId = getTokenId(document);
    chainId = getChainId(document);
  } catch (err) {
    throw new Error(
      `Failed to extract obligation document information: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!obligationRegistry) {
    throw new Error('Document does not contain a valid obligationRegistry address');
  }
  if (!tokenId) {
    throw new Error('Document does not contain a valid token ID');
  }
  if (!chainId) {
    throw new Error('Document does not contain a valid chain ID');
  }
  if (!(chainId in SUPPORTED_CHAINS)) {
    throw new Error(
      `Unsupported chain ID in obligation document: ${chainId}. Use a BoE document on a supported network.`,
    );
  }

  const network = SUPPORTED_CHAINS[chainId].name;
  const documentId = document.id || 'N/A';

  info(`Extracted from obligation document:`);
  info(`  Network: ${network} (Chain ID: ${chainId})`);
  info(`  Obligation Registry: ${obligationRegistry}`);
  info(`  Token ID: ${tokenId}`);
  info(`  Document ID: ${documentId}`);

  return {
    document,
    obligationRegistry,
    tokenId,
    network,
    documentId,
  };
};
