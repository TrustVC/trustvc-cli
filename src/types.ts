import { credentialStatus, issuer, RawVerifiableCredential } from '@trustvc/trustvc';

export type SignInput = {
  keyPairData: typeof issuer.IssuedDIDOption ;
  credential: RawVerifiableCredential;
  encryptionAlgorithm: typeof credentialStatus.cryptoSuiteName;
  pathToSignedVC: string;
}

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
