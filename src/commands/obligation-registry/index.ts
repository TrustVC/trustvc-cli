import { Argv } from 'yargs';

export const command = 'obligation-registry <method>';

export const describe =
  'Invoke a function over an Obligation Registry (BoE / TrustVCToken) smart contract';

export const builder = (yargs: Argv): Argv =>
  yargs.commandDir(__dirname, { extensions: ['ts', 'js'] });

export const handler = (): void => {};
