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
  let lastOwner = '';
  let lastHolder = '';
  const isZero = (value?: string) => !value || /^0x0{40}$/i.test(value);
  chain.forEach((event, index) => {
    const isShred =
      event.type === 'RETURN_TO_ISSUER_ACCEPTED' || event.type === 'SURRENDER_ACCEPTED';
    // eBoE shred keeps last owner/holder on the shred row.
    const owner = isZero(event.owner) ? lastOwner : event.owner || lastOwner;
    const holder = isZero(event.holder) ? lastHolder : event.holder || lastHolder;
    if (!isZero(owner)) lastOwner = owner;
    if (!isZero(holder)) lastHolder = holder;
    if (isShred) {
      lastOwner = '';
      lastHolder = '';
    }

    const when = event.timestamp ? new Date(event.timestamp).toISOString() : 'unknown-time';
    info(`  ${index + 1}. [${event.type}] block=${event.blockNumber} @ ${when}`);
    info(`     Owner:  ${owner || '-'}`);
    info(`     Holder: ${holder || '-'}`);
    if (isShred && event.terminationReason && event.terminationReason !== 'None') {
      const reasonLabel =
        event.terminationReason === 'ReturnToIssuer' ? 'Return to issuer' : event.terminationReason;
      info(`     Reason: ${reasonLabel}`);
    }
    if (event.remark) info(`     Remark: ${event.remark}`);
    if (event.transactionHash) info(`     Tx:     ${event.transactionHash}`);
  });
};
