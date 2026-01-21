// External dependencies
import { BytesLike, Wallet, HDNodeWallet, ZeroAddress, Provider } from 'ethers';
import signale from 'signale';
import {
  v5Contracts,
  checkSupportsInterface,
  v4SupportInterfaceIds,
  v5SupportInterfaceIds,
} from '@trustvc/trustvc';
import { encrypt } from '@trustvc/trustvc';

// Internal utilities
import { ConnectedSigner } from '../utils';

// Contract factories from TrustVC v5
const { TitleEscrow__factory, TradeTrustToken__factory } = v5Contracts;

// Interface for connectToTokenRegistry function arguments
interface ConnectToTokenRegistryArgs {
  address: string;
  wallet: Wallet | HDNodeWallet | ConnectedSigner;
}

/**
 * Connects to a token registry contract instance.
 *
 * @param address - The address of the token registry contract
 * @param wallet - The wallet or signer to use for the connection
 * @returns Promise resolving to the connected TradeTrustToken contract instance
 * @throws Error if connection fails
 */
export const connectToTokenRegistry = async ({
  address,
  wallet,
}: ConnectToTokenRegistryArgs): Promise<InstanceType<typeof TradeTrustToken__factory>> => {
  try {
    // Connect to the token registry contract
    signale.info(`Connecting to token registry at: ${address}`);
    const tokenRegistry = TradeTrustToken__factory.connect(address, wallet);

    // Validate the connection was successful
    if (!tokenRegistry) {
      const error = `Failed to connect to token registry at address: ${address}`;
      signale.error(error);
      throw new Error(error);
    }

    signale.success(`Successfully connected to token registry`);
    return tokenRegistry;
  } catch (error) {
    signale.error(
      `Error in connectToTokenRegistry: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
};
// Interface for connectToTitleEscrow function arguments
interface ConnectToTitleEscrowArgs {
  tokenId: string;
  address: string;
  wallet: Wallet | HDNodeWallet | ConnectedSigner;
}

/**
 * Connects to a title escrow contract instance for a specific token.
 * Retrieves the title escrow address from the token registry and establishes a connection.
 *
 * @param tokenId - The unique identifier of the token
 * @param address - The address of the token registry contract
 * @param wallet - The wallet or signer to use for the connection
 * @returns Promise resolving to the connected TitleEscrow contract instance
 * @throws Error if title escrow address is invalid or connection fails
 */
export const connectToTitleEscrow = async ({
  tokenId,
  address,
  wallet,
}: ConnectToTitleEscrowArgs): Promise<InstanceType<typeof TitleEscrow__factory>> => {
  try {
    // Connect to the token registry contract
    signale.info(`Connecting to token registry at: ${address}`);
    const tokenRegistry = TradeTrustToken__factory.connect(address, wallet);

    // Fetch the title escrow address by getting the owner of the token
    signale.info(`Fetching title escrow address for tokenId: ${tokenId}`);
    const titleEscrowAddress = await tokenRegistry.ownerOf(tokenId);
    signale.info(`Title escrow address: ${titleEscrowAddress}`);

    // Validate that the title escrow address is not zero/invalid
    if (!titleEscrowAddress || titleEscrowAddress === ZeroAddress) {
      const error = `Invalid title escrow address for tokenId: ${tokenId}. Address: ${titleEscrowAddress}`;
      signale.error(error);
      throw new Error(error);
    }

    // Connect to the title escrow contract
    signale.info(`Connecting to title escrow at: ${titleEscrowAddress}`);
    const titleEscrow = TitleEscrow__factory.connect(titleEscrowAddress, wallet);
    console.log(titleEscrow.tr);

    // Validate the connection was successful
    if (!titleEscrow) {
      const error = `Failed to connect to title escrow at address: ${titleEscrowAddress}`;
      signale.error(error);
      throw new Error(error);
    }

    signale.success(`Successfully connected to title escrow`);
    return titleEscrow;
  } catch (error) {
    signale.error(
      `Error in connectToTitleEscrow: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
};

// Interface for validateEndorseChangeOwner function arguments
interface validateEndorseChangeOwnerArgs {
  newHolder: string;
  newOwner: string;
  titleEscrow: InstanceType<typeof TitleEscrow__factory>;
}
/**
 * Validates that the new owner and holder are different from the current ones.
 * Prevents unnecessary transactions when attempting to transfer to the same addresses.
 *
 * @param newHolder - The proposed new holder address
 * @param newOwner - The proposed new owner (beneficiary) address
 * @param titleEscrow - The title escrow contract instance
 * @throws Error if new addresses match current addresses
 */
export const validateEndorseChangeOwner = async ({
  newHolder,
  newOwner,
  titleEscrow,
}: validateEndorseChangeOwnerArgs): Promise<void> => {
  // Get current beneficiary and holder from the contract
  const beneficiary = await titleEscrow.beneficiary();
  const holder = await titleEscrow.holder();

  // Check if both new addresses match the current ones
  if (newOwner === beneficiary && newHolder === holder) {
    const error =
      'new owner and new holder addresses are the same as the current owner and holder addresses';
    signale.error(error);
    throw new Error(error);
  }
};

// Interface for validateNominateBeneficiary function arguments
interface validateNominateBeneficiaryArgs {
  beneficiaryNominee: string;
  titleEscrow: InstanceType<typeof TitleEscrow__factory>;
}
/**
 * Validates that the nominated beneficiary is different from the current beneficiary.
 * Prevents nominating the same beneficiary that already exists.
 *
 * @param beneficiaryNominee - The proposed new beneficiary address
 * @param titleEscrow - The title escrow contract instance
 * @throws Error if the nominee is the same as the current beneficiary
 */
export const validateNominateBeneficiary = async ({
  beneficiaryNominee,
  titleEscrow,
}: validateNominateBeneficiaryArgs): Promise<void> => {
  // Get current beneficiary from the contract
  const beneficiary = await titleEscrow.beneficiary();

  // Check if the nominee is the same as the current beneficiary
  if (beneficiaryNominee === beneficiary) {
    const error = 'new beneficiary address is the same as the current beneficiary address';
    signale.error(error);
    throw new Error(error);
  }
};

/**
 * Validates that a previous beneficiary exists for rejection operations.
 * A previous beneficiary must be set to perform a beneficiary transfer rejection.
 *
 * @param titleEscrow - The title escrow contract instance
 * @throws Error if previous beneficiary is not set (zero address)
 */
export const validatePreviousBeneficiary = async (
  titleEscrow: InstanceType<typeof TitleEscrow__factory>,
): Promise<void> => {
  // Get the previous beneficiary from the contract
  const prevBeneficiary = await titleEscrow.prevBeneficiary();

  // Check if previous beneficiary is set (not zero address)
  if (prevBeneficiary === ZeroAddress) {
    const error = 'invalid rejection as previous beneficiary is not set';
    signale.error(error);
    throw new Error(error);
  }
};

/**
 * Validates that a previous holder exists for rejection operations.
 * A previous holder must be set to perform a holder transfer rejection.
 *
 * @param titleEscrow - The title escrow contract instance
 * @throws Error if previous holder is not set (zero address)
 */
export const validatePreviousHolder = async (
  titleEscrow: InstanceType<typeof TitleEscrow__factory>,
): Promise<void> => {
  // Get the previous holder from the contract
  const prevHolder = await titleEscrow.prevHolder();

  // Check if previous holder is set (not zero address)
  if (prevHolder === ZeroAddress) {
    const error = 'invalid rejection as previous holder is not set';
    signale.error(error);
    throw new Error(error);
  }
};

// Interface for validateEndorseTransferOwner function arguments
interface validateEndorseTransferOwnerArgs {
  approvedOwner: string | undefined;
  approvedHolder: string | undefined;
}

// Genesis address (zero address) constant
const GENESIS_ADDRESS = ZeroAddress;
/**
 * Validates that approved owner and holder exist and are not the genesis address.
 * Ensures that there are valid approved addresses before endorsing a transfer.
 *
 * @param approvedOwner - The approved owner address (may be undefined)
 * @param approvedHolder - The approved holder address (may be undefined)
 * @throws Error if approved addresses are missing or equal to genesis address
 */
export const validateEndorseTransferOwner = ({
  approvedOwner,
  approvedHolder,
}: validateEndorseTransferOwnerArgs): void => {
  // Check if approved addresses exist and are not the genesis address
  if (
    !approvedOwner ||
    !approvedHolder ||
    approvedOwner === GENESIS_ADDRESS ||
    approvedHolder === GENESIS_ADDRESS
  ) {
    const error = `there is no approved owner or holder or the approved owner or holder is equal to the genesis address: ${GENESIS_ADDRESS}`;
    signale.error(error);
    throw new Error(error);
  }
};

/**
 * Validates and encrypts a remark string for blockchain transactions.
 * Ensures the remark meets length requirements and encrypts it with the provided key.
 *
 * @param remark - Optional remark string to encrypt (max 120 characters)
 * @param keyId - Optional encryption key ID
 * @returns Encrypted remark as BytesLike (hex string), or '0x' if no remark provided
 * @throws Error if remark exceeds 120 characters
 */
export const validateAndEncryptRemark = (remark?: string, keyId?: string): BytesLike => {
  // Validate remark length (max 120 characters)
  if (remark && remark.length > 120) {
    const error = `Remark length is more than 120 characters`;
    signale.error(error);
    throw new Error(error);
  }

  // Return empty hex string if no remark provided
  if (!remark || remark?.length === 0) {
    return '0x';
  }

  // Encrypt the remark and ensure it has '0x' prefix
  const encrpyted = encrypt(remark, keyId ?? '');
  return encrpyted.startsWith('0x') ? encrpyted : `0x${encrpyted}`;
};

/**
 * Determines the version of a token registry contract by checking supported interfaces.
 * Checks for V5 first, then V4 compatibility.
 *
 * @param tokenRegistryAddress - The address of the token registry contract
 * @param provider - The provider to use for the contract call
 * @returns Promise resolving to 'v5', 'v4', or 'unknown'
 */
export const getTokenRegistryVersion = async (
  tokenRegistryAddress: string,
  provider: Provider,
): Promise<'v5' | 'v4' | 'unknown'> => {
  try {
    // Check if it's V5
    const isV5 = await checkSupportsInterface(
      tokenRegistryAddress,
      v5SupportInterfaceIds.SBT,
      provider,
    );

    if (isV5) {
      return 'v5';
    }

    // Check if it's V4
    const isV4 = await checkSupportsInterface(
      tokenRegistryAddress,
      v4SupportInterfaceIds.SBT,
      provider,
    );

    if (isV4) {
      return 'v4';
    }

    return 'unknown';
  } catch (error) {
    throw new Error(
      `Failed to determine token registry version: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
