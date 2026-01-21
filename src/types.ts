import { credentialStatus, issuer, RawVerifiableCredential } from '@trustvc/trustvc';
import {
  NetworkAndWalletSignerOption,
  NetworkOption,
  RpcUrlOption,
  WalletOrSignerOption,
} from './utils';

export type SignInput = {
  credential: RawVerifiableCredential;
  keyPairData: typeof issuer.IssuedDIDOption;
  encryptionAlgorithm: typeof credentialStatus.cryptoSuiteName;
  pathToSignedVC: string;
};
export type DidInput = {
  keyPairPath: string;
  domainName: string;
  outputPath: string;
};

export type KeyPairGenerateInput = {
  encAlgo: typeof issuer.VerificationType;
  seedBase58: string;
  keyPath: string;
};

export type CredentialStatusQuestionType = {
  type?: string;
  keyPairPath?: string;
  keypairData?: any;
  cryptoSuite?: typeof credentialStatus.cryptoSuiteName;
  hostingUrl?: string;
  outputPath?: string;
  length?: number;
  credentialStatus?: typeof credentialStatus.StatusList;
  purpose?: typeof credentialStatus.CredentialStatusPurpose;
  continue?: boolean;
  index?: number;
  status?: boolean;
};

export type TokenRegistryMintCommand = NetworkOption &
  Partial<RpcUrlOption> &
  WalletOrSignerOption &
  GasPriceScale & {
    address: string;
    beneficiary: string;
    holder: string;
    tokenId: string;
    remark?: string;
    encryptionKey?: string;
  };

export type BaseTitleEscrowCommand = NetworkAndWalletSignerOption &
  GasPriceScale & {
    tokenRegistryAddress: string;
    tokenId: string;
    remark?: string;
    encryptionKey?: string;
  };
export type TitleEscrowTransferHolderCommand = BaseTitleEscrowCommand & {
  newHolder: string;
};

export type TitleEscrowEndorseTransferOfOwnersCommand = BaseTitleEscrowCommand & {
  newHolder: string;
  newOwner: string;
};

export type TitleEscrowNominateBeneficiaryCommand = BaseTitleEscrowCommand & {
  newBeneficiary: string;
};
