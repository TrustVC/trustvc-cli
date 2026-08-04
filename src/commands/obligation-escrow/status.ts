import { info, success } from 'signale';
import {
  ObligationDocumentStatus,
  ObligationEscrowTerminationReason,
  getObligationEscrowTerminationReason,
  getObligationRegistryStatus,
  isObligationRegistryRegistered,
} from '@trustvc/trustvc';
import { Signer } from 'ethers';
import { BaseObligationEscrowCommand } from '../../types';
import {
  extractObligationDocumentInfo,
  getSupportedNetwork,
  promptAndReadDocument,
  verifyDocumentSignature,
  toSdkSigner,
} from '../../utils';
import { runObligationEscrowCommand } from './shared';

export const command = 'status';
export const describe = 'Read BoE obligation escrow status / registration / termination reason';

const STATUS_LABEL: Record<number, string> = {
  [ObligationDocumentStatus.Issued]: 'Issued',
  [ObligationDocumentStatus.Accepted]: 'Accepted',
  [ObligationDocumentStatus.Rejected]: 'Rejected',
  [ObligationDocumentStatus.Discharged]: 'Discharged',
};
const REASON_LABEL: Record<number, string> = {
  [ObligationEscrowTerminationReason.None]: 'None',
  [ObligationEscrowTerminationReason.ReturnToIssuer]: 'ReturnToIssuer',
  [ObligationEscrowTerminationReason.Rejected]: 'Rejected',
  [ObligationEscrowTerminationReason.Discharged]: 'Discharged',
};

/** Read-only status inputs — document only; no wallet or remark. */
export type ObligationEscrowStatusCommand = Pick<
  BaseObligationEscrowCommand,
  'network' | 'obligationRegistryAddress' | 'tokenId'
>;

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, statusHandler);

export const promptForInputs = async (): Promise<ObligationEscrowStatusCommand> => {
  const document = await promptAndReadDocument();
  await verifyDocumentSignature(document);
  const { obligationRegistry, tokenId, network } = await extractObligationDocumentInfo(document);
  return {
    network,
    obligationRegistryAddress: obligationRegistry,
    tokenId,
  };
};

export const statusHandler = async (args: ObligationEscrowStatusCommand) => {
  const { obligationRegistryAddress, tokenId, network } = args;
  // SDK view readers only need signer.provider; use network RPC (no signing key).
  const provider = getSupportedNetwork(network).provider();
  const readOnlySigner = { provider } as unknown as Signer;
  const opts = { obligationRegistryAddress, tokenId };

  const status = await getObligationRegistryStatus(opts, toSdkSigner(readOnlySigner), { tokenId });
  const registered = await isObligationRegistryRegistered(opts, toSdkSigner(readOnlySigner), {
    tokenId,
  });
  const reason = await getObligationEscrowTerminationReason(opts, toSdkSigner(readOnlySigner), {
    tokenId,
  });

  success(`Obligation ${tokenId} on ${obligationRegistryAddress}`);
  info(`  Status: ${STATUS_LABEL[status] ?? status} (${status})`);
  info(`  Registered: ${registered}`);
  info(`  Termination reason: ${REASON_LABEL[reason] ?? reason} (${reason})`);
};
