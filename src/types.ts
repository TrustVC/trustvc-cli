import { issuer } from '@trustvc/trustvc';

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
