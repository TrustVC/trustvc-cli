/**
 * Gasless transactions sign an EIP-7702 authorization and a UserOperation locally, so only wallet
 * inputs that expose a raw private key are supported (no AWS KMS remote signer). All three fields
 * are optional and set together (never a union) since every gasless prompt flow passes all of
 * them through from `promptWalletSelection()` regardless of which one is actually populated.
 */
export type GaslessWalletOption = {
  encryptedWalletPath?: string;
  key?: string;
  keyFile?: string;
};

export type BaseGaslessTitleEscrowCommand = GaslessWalletOption & {
  network: string;
  tokenRegistryAddress: string;
  tokenId: string;
  /** PlatformPaymaster contract address sponsoring gas; always prompted, never read from env. */
  paymasterAddress: string;
  remark?: string;
  encryptionKey?: string;
};

/** Reject commands only cancel a pending transfer; no address inputs beyond the base fields. */
export type TitleEscrowRejectTransferGaslessCommand = BaseGaslessTitleEscrowCommand;

export type TitleEscrowTransferHolderGaslessCommand = BaseGaslessTitleEscrowCommand & {
  newHolder: string;
};

export type TitleEscrowTransferBeneficiaryGaslessCommand = BaseGaslessTitleEscrowCommand & {
  newBeneficiary: string;
};

export type TitleEscrowNominateBeneficiaryGaslessCommand = BaseGaslessTitleEscrowCommand & {
  newBeneficiary: string;
};

export type TitleEscrowTransferOwnersGaslessCommand = BaseGaslessTitleEscrowCommand & {
  newOwner: string;
  newHolder: string;
};

/** Returning a document to the issuer is a title-escrow action; same shape as the reject commands. */
export type TitleEscrowReturnDocumentGaslessCommand = BaseGaslessTitleEscrowCommand;

/**
 * Accepting/rejecting a returned document acts directly on the token registry (the registry admin
 * burns or restores the token) rather than on a title escrow, but the input shape is identical.
 */
export type TokenRegistryReturnedDocumentGaslessCommand = BaseGaslessTitleEscrowCommand;

/** Minting creates a new title escrow, so there is no existing one to resolve beforehand. */
export type TokenRegistryMintGaslessCommand = GaslessWalletOption & {
  network: string;
  tokenRegistryAddress: string;
  tokenId: string;
  beneficiary: string;
  holder: string;
  /** PlatformPaymaster contract address sponsoring gas; always prompted, never read from env. */
  paymasterAddress: string;
  remark?: string;
  encryptionKey?: string;
};
