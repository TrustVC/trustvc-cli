import { Argv } from 'yargs';

export const command = 'document-store <method>';

export const describe = 'Invoke a function over a document store smart contract on the blockchain';

export const builder = (yargs: Argv): Argv =>
  yargs.commandDir(__dirname, { extensions: ['ts', 'js'] });

export const handler = (): void => {};
