import { Argv } from 'yargs';

export const command = 'wallet <method>';

export const describe = 'Manage encrypted wallet files';

export const builder = (yargs: Argv): Argv =>
  yargs.commandDir(__dirname, { extensions: ['ts', 'js'] });

export const handler = (): void => {};
