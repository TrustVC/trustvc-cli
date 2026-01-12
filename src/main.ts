#!/usr/bin/env node
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
