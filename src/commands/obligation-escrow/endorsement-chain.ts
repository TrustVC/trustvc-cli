import { info, success } from 'signale';
import { fetchEndorsementChain } from '@trustvc/trustvc';
import { BaseObligationEscrowCommand } from '../../types';
import {
  extractObligationDocumentInfo,
  getSupportedNetwork,
  promptAndReadDocument,
  verifyDocumentSignature,
} from '../../utils';
import { runObligationEscrowCommand } from './shared';

export const command = 'endorsement-chain';
export const describe =
  'Fetch BoE obligation endorsement chain (transfers + status events) via network Infura/RPC';

/** Read-only — document only; decrypt remarks with credential `id`. */
export type ObligationEscrowEndorsementChainCommand = Pick<
  BaseObligationEscrowCommand,
  'network' | 'obligationRegistryAddress' | 'tokenId' | 'encryptionKey'
>;

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, endorsementChainHandler);

export const promptForInputs = async (): Promise<ObligationEscrowEndorsementChainCommand> => {
  const document = await promptAndReadDocument();
  await verifyDocumentSignature(document);
  const { obligationRegistry, tokenId, network, documentId } =
    await extractObligationDocumentInfo(document);
  return {
    network,
    obligationRegistryAddress: obligationRegistry,
    tokenId,
    encryptionKey: documentId,
  };
};

export const endorsementChainHandler = async (args: ObligationEscrowEndorsementChainCommand) => {
  const { obligationRegistryAddress, tokenId, network, encryptionKey } = args;
  // Always use ChainInfo/Infura-style network RPC — never a wallet provider (MetaMask range caps).
  const provider = getSupportedNetwork(network).provider();

  info(`Fetching endorsement chain for ${tokenId} on ${obligationRegistryAddress} (${network})…`);
  const chain = await fetchEndorsementChain(
    obligationRegistryAddress,
    tokenId,
    provider as any,
    encryptionKey,
  );

  success(`Endorsement chain (${chain.length} event${chain.length === 1 ? '' : 's'})`);
  chain.forEach((event, index) => {
    const when = event.timestamp ? new Date(event.timestamp).toISOString() : 'unknown-time';
    info(`  ${index + 1}. [${event.type}] block=${event.blockNumber} @ ${when}`);
    if (event.owner) info(`     Owner:  ${event.owner}`);
    if (event.holder) info(`     Holder: ${event.holder}`);
    if (event.remark) info(`     Remark: ${event.remark}`);
    if (event.transactionHash) info(`     Tx:     ${event.transactionHash}`);
  });
};
