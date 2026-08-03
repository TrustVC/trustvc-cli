import { Argv } from 'yargs';

export const command = 'obligation-escrow <method>';

export const describe =
  'Invoke ObligationEscrow lifecycle / transfer functions for BoE obligation records';

export const builder = (yargs: Argv): Argv =>
  yargs.commandDir(__dirname, {
    extensions: ['ts', 'js'],
    exclude: /(runTx|shared)\.(ts|js)$/,
  });

export const handler = (): void => {};
