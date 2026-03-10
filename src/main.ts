#!/usr/bin/env node
const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  console.error(
    `Error: Node.js 22 or higher is required. You are using Node.js ${process.versions.node}.`,
  );
  console.error('Please upgrade: https://nodejs.org or use nvm: nvm install 22 && nvm use 22');
  process.exit(1);
}

import path from 'path';
import yargs from 'yargs';
import signale from 'signale';
import { hideBin } from 'yargs/helpers';

void yargs(hideBin(process.argv))
  .scriptName('trustvc')
  .commandDir(path.join(__dirname, 'commands'), { extensions: ['ts', 'js'], recurse: true })
  .demandCommand()
  .strict()
  .help()
  .fail((msg, err, yargs) => {
    if (err) throw err; // preserve stack
    signale.error(msg);
    console.error(yargs.help());
  }).argv;
