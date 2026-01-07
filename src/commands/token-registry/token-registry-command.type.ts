import {
  GasOption,
  NetworkOption,
  WalletOrSignerOption,
  RpcUrlOption,
} from '../../utils';

export type TokenRegistryMintCommand = NetworkOption &
  Partial<RpcUrlOption> &
  WalletOrSignerOption &
  GasOption & {
    address: string;
    beneficiary: string;
    holder: string;
    tokenId: string;
    remark?: string;
    encryptionKey?: string;
  };
