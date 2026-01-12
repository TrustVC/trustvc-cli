export const command = 'mint';
export const describe = 'Mint a hash to a token registry deployed on the blockchain';
export { mintHandler as handler } from '../token-registry/token-registry';
