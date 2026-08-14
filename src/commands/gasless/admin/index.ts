import { Argv } from 'yargs';

export const command = 'paymaster-admin <method>';

export const describe =
  'Administer a PlatformPaymaster contract (owner-only; regular, non-gasless transactions)';

export const builder = (yargs: Argv): Argv =>
  yargs.commandDir(__dirname, { extensions: ['ts', 'js'] });

export const handler = (): void => {};
