import { info, success } from 'signale';
import {
  ObligationDocumentStatus,
  ObligationEscrowTerminationReason,
  getTitleEscrowAddress,
  getObligationEscrowTerminationReason,
  getObligationRegistryStatus,
  isObligationRegistryRegistered,
  v5Contracts,
} from '@trustvc/trustvc';
import { Contract, VoidSigner, ZeroAddress } from 'ethers';
import { BaseObligationEscrowCommand } from '../../types';
import {
  extractObligationDocumentInfo,
  getSupportedNetwork,
  promptAndReadDocument,
  verifyDocumentSignature,
  toSdkSigner,
} from '../../utils';
import { runObligationEscrowCommand } from './shared';

const { ObligationEscrow__factory } = v5Contracts;

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
  const readOnlySigner = new VoidSigner(ZeroAddress, provider);
  const opts = { obligationRegistryAddress, tokenId };

  const [status, registered, reason] = await Promise.all([
    getObligationRegistryStatus(opts, toSdkSigner(readOnlySigner), { tokenId }),
    isObligationRegistryRegistered(opts, toSdkSigner(readOnlySigner), { tokenId }),
    getObligationEscrowTerminationReason(opts, toSdkSigner(readOnlySigner), { tokenId }),
  ]);

  const isZero = (value?: string) => !value || value === ZeroAddress;

  let escrowAddress: string | undefined;
  let beneficiary = '';
  let holder = '';
  let nominee = '';
  try {
    escrowAddress = await getTitleEscrowAddress(
      obligationRegistryAddress,
      tokenId,
      provider as any,
      {
        titleEscrowVersion: 'v5',
      },
    );
    const escrow = new Contract(escrowAddress, ObligationEscrow__factory.abi, provider);
    const [currentBeneficiary, currentHolder, currentNominee, lastBeneficiary, lastHolder] =
      await Promise.all([
        escrow.beneficiary(),
        escrow.holder(),
        escrow.nominee(),
        escrow.lastBeneficiary(),
        escrow.lastHolder(),
      ]);
    beneficiary = isZero(currentBeneficiary) ? lastBeneficiary : currentBeneficiary;
    holder = isZero(currentHolder) ? lastHolder : currentHolder;
    nominee = currentNominee;
  } catch {
    // Escrow address may not resolve, or escrow may be inactive / unreadable after shred —
    // still print registry-level status.
  }

  success(`Obligation ${tokenId} on ${obligationRegistryAddress}`);
  if (escrowAddress) info(`  Escrow: ${escrowAddress}`);
  info(`  Status: ${STATUS_LABEL[status] ?? status} (${status})`);
  info(`  Registered: ${registered}`);
  info(`  Termination reason: ${REASON_LABEL[reason] ?? reason} (${reason})`);
  if (!isZero(beneficiary)) info(`  Owner (beneficiary): ${beneficiary}`);
  if (!isZero(holder)) info(`  Holder: ${holder}`);
  if (nominee && nominee !== ZeroAddress) info(`  Nominee: ${nominee}`);
};
