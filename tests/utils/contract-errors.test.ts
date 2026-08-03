import { describe, expect, it } from 'vitest';
import {
  describeContractError,
  extractContractRevertLabel,
  getErrorMessage,
  isContractCallException,
} from '../../src/utils';

describe('contract revert error formatting', () => {
  const ownerHolderError = Object.assign(new Error('execution reverted: OwnerHolderMustDiffer()'), {
    code: 'CALL_EXCEPTION',
    reason: null,
    revert: { name: 'OwnerHolderMustDiffer', signature: 'OwnerHolderMustDiffer()', args: [] },
    shortMessage: 'execution reverted (unknown custom error)',
  });

  it('extracts OwnerHolderMustDiffer from ethers call exceptions', () => {
    expect(extractContractRevertLabel(ownerHolderError)).toBe('OwnerHolderMustDiffer');
    expect(isContractCallException(ownerHolderError)).toBe(true);
  });

  it('maps OwnerHolderMustDiffer to an actionable message', () => {
    expect(describeContractError(ownerHolderError)).toMatch(
      /OwnerHolderMustDiffer: Beneficiary \(owner\) and holder must be different/,
    );
    expect(getErrorMessage(ownerHolderError)).toMatch(/OwnerHolderMustDiffer:/);
  });

  it('does not return null when reason is null', () => {
    expect(getErrorMessage(ownerHolderError)).not.toBe('null');
    expect(getErrorMessage(ownerHolderError)).toBeTruthy();
  });

  it('decodes OwnerHolderMustDiffer from revert data when name is missing', () => {
    // Typical gas-estimation shape: undecoded shortMessage + selector only
    const gasEstimateError = Object.assign(new Error('execution reverted'), {
      code: 'CALL_EXCEPTION',
      reason: null,
      data: '0x7e288225',
      shortMessage: 'execution reverted (unknown custom error)',
    });

    expect(extractContractRevertLabel(gasEstimateError)).toBe('OwnerHolderMustDiffer');
    expect(getErrorMessage(gasEstimateError)).toMatch(
      /OwnerHolderMustDiffer: Beneficiary \(owner\) and holder must be different/,
    );
    expect(getErrorMessage(gasEstimateError)).not.toMatch(/unknown custom error/i);
  });

  it('rewrites SDK pre-check wrappers', () => {
    const wrapped = new Error(
      'Pre-check for accept failed: OwnerHolderMustDiffer: Beneficiary (owner) and holder must be different wallets before accept/reject can run. Remint with different beneficiary and holder addresses.',
    );
    expect(getErrorMessage(wrapped)).toMatch(/OwnerHolderMustDiffer:/);
  });

  it('rejects generic failed: suffixes that are not contract reverts', () => {
    const preprocessing = new Error('SDK preprocessing failed: badInput');
    expect(extractContractRevertLabel(preprocessing)).toBeUndefined();
    expect(isContractCallException(preprocessing)).toBe(false);
  });

  it('preserves Contract reverted with labels', () => {
    const wrapped = new Error('Contract reverted with OwnerHolderMustDiffer');
    expect(extractContractRevertLabel(wrapped)).toBe('OwnerHolderMustDiffer');
  });

  it('does not extract a label from multi-word free-text reasons', () => {
    const freeText = Object.assign(new Error('execution reverted'), {
      code: 'CALL_EXCEPTION',
      reason: 'insufficient funds for gas * price + value',
      shortMessage: 'insufficient funds for gas * price + value',
    });
    expect(extractContractRevertLabel(freeText)).toBeUndefined();
    expect(describeContractError(freeText)).toBe('insufficient funds for gas * price + value');
  });

  it('does not treat lowercase single-word reasons as Solidity custom errors', () => {
    const timeout = Object.assign(new Error('timeout'), {
      code: 'CALL_EXCEPTION',
      reason: 'timeout',
      shortMessage: 'timeout',
    });
    expect(extractContractRevertLabel(timeout)).toBeUndefined();
    expect(describeContractError(timeout)).toBe('timeout');
    expect(describeContractError(timeout)).not.toMatch(/Contract reverted with timeout/);
  });
});
