import { info, success } from 'signale';
import {
  ObligationDocumentStatus,
  ObligationEscrowTerminationReason,
  getObligationEscrowTerminationReason,
  getObligationRegistryStatus,
  isObligationRegistryRegistered,
} from '@trustvc/trustvc';
import { BaseObligationEscrowCommand } from '../../types';
import { getWalletOrSigner } from '../../utils';
import { promptBaseObligationEscrowInputs, runObligationEscrowCommand } from './shared';

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

export const handler = async (): Promise<void> =>
  runObligationEscrowCommand(promptForInputs, statusHandler);

export const promptForInputs = promptBaseObligationEscrowInputs;

export const statusHandler = async (args: BaseObligationEscrowCommand) => {
  const { obligationRegistryAddress, tokenId, network, ...rest } = args;
  const wallet = await getWalletOrSigner({ network, ...rest });
  // Escrow resolution uses contractOptions.tokenId (params.tokenId is API parity only).
  const opts = { obligationRegistryAddress, tokenId };

  const status = await getObligationRegistryStatus(opts, wallet, { tokenId });
  const registered = await isObligationRegistryRegistered(opts, wallet, { tokenId });
  const reason = await getObligationEscrowTerminationReason(opts, wallet, { tokenId });

  success(`Obligation ${tokenId} on ${obligationRegistryAddress}`);
  info(`  Status: ${STATUS_LABEL[status] ?? status} (${status})`);
  info(`  Registered: ${registered}`);
  info(`  Termination reason: ${REASON_LABEL[reason] ?? reason} (${reason})`);
};
