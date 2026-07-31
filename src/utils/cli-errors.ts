/**
 * Shared helpers for decoding ethers CALL_EXCEPTION / custom errors into
 * clear CLI messages (gas estimation often leaves revert.name unset).
 */

export type ErrnoException = NodeJS.ErrnoException;

export type CliErrorOptions = {
  defaultMessage: string;
  fileNotFound?: string; // use {path} for the path
  permissionDenied?: string; // use {path} for the path
  invalidJson?: (syntaxMessage: string) => string;
};

const DEFAULT_PATH_PLACEHOLDER = 'the specified path';

/** Known on-chain custom errors → actionable CLI guidance. */
const KNOWN_REVERT_MESSAGES: Record<string, string> = {
  OwnerHolderMustDiffer:
    'Beneficiary (owner) and holder must be different wallets before accept/reject can run. Remint with different beneficiary and holder addresses.',
  CallerNotBeneficiary: 'Connected wallet is not the beneficiary for this obligation.',
  CallerNotHolder: 'Connected wallet is not the holder for this obligation.',
  NotRegistered: "This token ID hasn't been minted on this registry yet.",
  RemarkLengthExceeded: 'The remark is too long. Shorten it and try again.',
  RegistryContractPaused: 'This registry is paused — unpause it before continuing.',
  InactiveTitleEscrow: 'This obligation escrow is inactive.',
  TitleEscrowNotHoldingToken: 'This escrow is not holding the token.',
  DualRoleRejectionRequired:
    'Both beneficiary and holder roles are required to reject this transfer.',
  TokenNotReturnedToIssuer: 'Token must be returned to issuer before this action.',
  RecipientAlreadyHolder: 'Recipient is already the holder.',
  InvalidNominee: 'The nominee address is invalid.',
  InvalidTransferToZeroAddress: 'Cannot transfer to the zero address.',
  NomineeAlreadyNominated: 'This nominee is already nominated.',
  TargetNomineeAlreadyBeneficiary: 'The nominee is already the beneficiary.',
  AlreadyRegistered: 'This token ID is already minted on this registry.',
  TokenExists: 'This token ID already exists on this registry.',
  AccessControlUnauthorizedAccount: 'Connected wallet is not authorized for this action.',
  CallerNotMinter: 'Connected wallet does not hold MINTER_ROLE on this registry.',
  InvalidStatusTransition: 'This action is not allowed from the current obligation status.',
  EmptyReceivingData: 'Receiving data was empty.',
  InvalidTokenId: 'The token ID is invalid.',
  InvalidRegistry: 'The registry address is invalid.',
};

/**
 * keccak256 selectors for no-arg / known signatures. Gas estimation often returns
 * only `data: 0x<selector>` with shortMessage "execution reverted (unknown custom error)".
 */
const REVERT_SELECTOR_TO_NAME: Record<string, string> = {
  '0x7e288225': 'OwnerHolderMustDiffer',
  '0xf52018ac': 'CallerNotBeneficiary',
  '0x667b3fbf': 'CallerNotHolder',
  '0xaba47339': 'NotRegistered',
  '0x14086584': 'RemarkLengthExceeded',
  '0xad49811c': 'RegistryContractPaused',
  '0x7c339b19': 'InactiveTitleEscrow',
  '0x2fd39523': 'TitleEscrowNotHoldingToken',
  '0x8c90bf45': 'DualRoleRejectionRequired',
  '0xd5475a0b': 'TokenNotReturnedToIssuer',
  '0x702e6e62': 'RecipientAlreadyHolder',
  '0x1c98cac3': 'InvalidNominee',
  '0x2c75c45a': 'InvalidTransferToZeroAddress',
  '0x98f83ce8': 'NomineeAlreadyNominated',
  '0xdd9f921d': 'TargetNomineeAlreadyBeneficiary',
  '0x3a81d6fc': 'AlreadyRegistered',
  '0x55c7e8ba': 'TokenExists',
  '0x10daa94f': 'EmptyReceivingData',
  '0xe3962ba3': 'InvalidStatusTransition',
  '0xed15e6cf': 'InvalidTokenId',
  '0x540b9601': 'InvalidRegistry',
  '0xbd805e91': 'InvalidTokenTransferToZeroAddressOwners',
  '0xe2517d3f': 'AccessControlUnauthorizedAccount',
  '0x5eee367a': 'CallerNotMinter',
};

const UNKNOWN_CUSTOM_ERROR = /unknown custom error/i;

type EthersCallException = {
  reason?: unknown;
  shortMessage?: unknown;
  message?: unknown;
  revert?: { name?: unknown };
  errorName?: unknown;
  code?: unknown;
  data?: unknown;
  info?: { error?: { data?: unknown; message?: unknown } };
  error?: { data?: unknown; message?: unknown };
};

const asEthersError = (value: unknown): EthersCallException | null =>
  typeof value === 'object' && value !== null ? (value as EthersCallException) : null;

const normalizeLabel = (raw: string): string | undefined => {
  const cleaned = raw.trim().replace(/\(\)$/, '');
  if (!cleaned || UNKNOWN_CUSTOM_ERROR.test(cleaned) || cleaned === '(unknown custom error)') {
    return undefined;
  }
  // Drop leading junk like ": OwnerHolderMustDiffer" or parentheses wrappers
  const ident = cleaned.match(/([A-Za-z][A-Za-z0-9_]*)/);
  return ident?.[1];
};

const collectPossibleData = (err: EthersCallException): string[] => {
  const values: unknown[] = [err.data, err.info?.error?.data, err.error?.data];
  const out: string[] = [];
  for (const v of values) {
    if (typeof v === 'string' && /^0x[0-9a-fA-F]+$/i.test(v)) {
      out.push(v.toLowerCase());
    } else if (typeof v === 'object' && v !== null && 'data' in v) {
      const nested = (v as { data?: unknown }).data;
      if (typeof nested === 'string' && /^0x[0-9a-fA-F]+$/i.test(nested)) {
        out.push(nested.toLowerCase());
      }
    }
  }
  return out;
};

const labelFromRevertData = (err: EthersCallException): string | undefined => {
  for (const data of collectPossibleData(err)) {
    if (data === '0x') continue;
    const selector = data.slice(0, 10);
    if (REVERT_SELECTOR_TO_NAME[selector]) {
      return REVERT_SELECTOR_TO_NAME[selector];
    }
  }
  return undefined;
};

export function extractContractRevertLabel(error: unknown): string | undefined {
  const err = asEthersError(error);
  if (!err) {
    if (error instanceof Error) {
      const fromMessage = error.message.match(
        /(?:execution reverted:\s*|Contract reverted with\s*|failed:\s*)([A-Za-z0-9_]+)/,
      );
      return fromMessage?.[1] ? normalizeLabel(fromMessage[1]) : undefined;
    }
    return undefined;
  }

  const revertName = err.revert?.name ?? err.errorName;
  if (typeof revertName === 'string') {
    const label = normalizeLabel(revertName);
    if (label) return label;
  }

  if (typeof err.reason === 'string') {
    const label = normalizeLabel(err.reason);
    if (label) return label;
  }

  // Prefer selector decoding before shortMessage — gas estimate often only has
  // "execution reverted (unknown custom error)" + data: 0x7e288225
  const fromData = labelFromRevertData(err);
  if (fromData) return fromData;

  if (typeof err.shortMessage === 'string' && err.shortMessage.trim()) {
    if (!UNKNOWN_CUSTOM_ERROR.test(err.shortMessage)) {
      const match = err.shortMessage.match(/execution reverted(?::\s*)?(.+)?/i);
      if (match?.[1]) {
        const label = normalizeLabel(match[1]);
        if (label) return label;
      }
    }
  }

  if (typeof err.message === 'string') {
    const custom = err.message.match(/execution reverted:\s*([A-Za-z0-9_]+)/);
    if (custom?.[1]) {
      const label = normalizeLabel(custom[1]);
      if (label) return label;
    }
    const wrapped = err.message.match(/(?:Contract reverted with\s*|failed:\s*)([A-Za-z0-9_]+)/);
    if (wrapped?.[1]) {
      const label = normalizeLabel(wrapped[1]);
      if (label) return label;
    }
  }

  return undefined;
}

/** True when the failure is a definitive on-chain revert (not a transient gas/RPC issue). */
export function isContractCallException(error: unknown): boolean {
  const err = asEthersError(error);
  if (!err) {
    if (error instanceof Error && /Pre-check .* failed:/i.test(error.message)) {
      return Boolean(extractContractRevertLabel(error));
    }
    return false;
  }
  if (err.code === 'CALL_EXCEPTION') return true;
  if (err.revert?.name || err.errorName) return true;
  if (labelFromRevertData(err)) return true;
  return Boolean(extractContractRevertLabel(error));
}

/** Maps ethers / contract errors to a short user-facing message. */
export function describeContractError(error: unknown): string {
  const label = extractContractRevertLabel(error);
  if (label && KNOWN_REVERT_MESSAGES[label]) {
    return `${label}: ${KNOWN_REVERT_MESSAGES[label]}`;
  }
  if (label) {
    return `Contract reverted with ${label}`;
  }

  const err = asEthersError(error);
  if (err) {
    // Never surface the useless ethers placeholder as the final message
    if (
      typeof err.shortMessage === 'string' &&
      err.shortMessage.trim() &&
      !UNKNOWN_CUSTOM_ERROR.test(err.shortMessage)
    ) {
      return err.shortMessage;
    }
    if (typeof err.reason === 'string' && err.reason.trim()) {
      return err.reason;
    }
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message.split('\n')[0]!;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message.split('\n')[0]!;
  }

  return String(error);
}

export function isErrnoException(err: unknown): err is ErrnoException {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as ErrnoException).code === 'string'
  );
}

export function isSyntaxError(err: unknown): err is SyntaxError {
  return err instanceof SyntaxError;
}

export function isErrorWithMessage(err: unknown): err is Error & { message: string } {
  return err instanceof Error && typeof err.message === 'string';
}

/** Picks a user-facing message from options based on error type (ENOENT, EACCES, SyntaxError, or fallback). */
export function getCliErrorMessage(err: unknown, options: CliErrorOptions): string {
  if (isErrnoException(err)) {
    const path = err.path ?? DEFAULT_PATH_PLACEHOLDER;
    if (err.code === 'ENOENT' && options.fileNotFound) {
      return options.fileNotFound.replace('{path}', String(path));
    }
    if (err.code === 'EACCES' && options.permissionDenied) {
      return options.permissionDenied.replace('{path}', String(path));
    }
  }

  if (isSyntaxError(err) && options.invalidJson) {
    return options.invalidJson(err.message);
  }

  if (isErrorWithMessage(err)) {
    return err.message;
  }

  return options.defaultMessage;
}
