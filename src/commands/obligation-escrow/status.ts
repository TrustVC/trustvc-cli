import { error, info, success } from 'signale';
import {
  DocumentStatus,
  ObligationEscrowTerminationReason,
  getObligationEscrowTerminationReason,
  getObligationRegistryStatus,
  isObligationRegistryRegistered,
} from '@trustvc/trustvc';
import { BaseObligationEscrowCommand } from '../../types';
import { getErrorMessage, getWalletOrSigner } from '../../utils';
import { promptBaseObligationEscrowInputs } from './shared';

export const command = 'status';
export const describe = 'Read BoE obligation escrow status / registration / termination reason';

const STATUS_LABEL: Record<number, string> = {
  [DocumentStatus.Issued]: 'Issued',
  [DocumentStatus.Accepted]: 'Accepted',
  [DocumentStatus.Rejected]: 'Rejected',
  [DocumentStatus.Discharged]: 'Discharged',
};

const REASON_LABEL: Record<number, string> = {
  [ObligationEscrowTerminationReason.None]: 'None',
  [ObligationEscrowTerminationReason.ReturnToIssuer]: 'ReturnToIssuer',
  [ObligationEscrowTerminationReason.Rejected]: 'Rejected',
  [ObligationEscrowTerminationReason.Discharged]: 'Discharged',
};

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await statusHandler(answers);
  } catch (err: unknown) {
    error(err instanceof Error ? err.message : String(err));
  }
};

export const promptForInputs = promptBaseObligationEscrowInputs;

export const statusHandler = async (args: BaseObligationEscrowCommand) => {
  try {
    const { obligationRegistryAddress, tokenId, network, ...rest } = args;
    const wallet = await getWalletOrSigner({ network, ...rest });
    const opts = { obligationRegistry: obligationRegistryAddress };

    const status = await getObligationRegistryStatus(opts, wallet, { tokenId });
    const registered = await isObligationRegistryRegistered(opts, wallet, { tokenId });
    const reason = await getObligationEscrowTerminationReason(opts, wallet, { tokenId });

    success(`Obligation ${tokenId} on ${obligationRegistryAddress}`);
    info(`  Status: ${STATUS_LABEL[status] ?? status} (${status})`);
    info(`  Registered: ${registered}`);
    info(`  Termination reason: ${REASON_LABEL[reason] ?? reason} (${reason})`);
  } catch (e) {
    error(getErrorMessage(e));
  }
};
