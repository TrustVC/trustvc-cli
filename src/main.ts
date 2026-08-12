#!/usr/bin/env node
const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  console.error(
    `Error: Node.js 22 or higher is required. You are using Node.js ${process.versions.node}.`,
  );
  console.error('Please upgrade: https://nodejs.org or use nvm: nvm install 22 && nvm use 22');
  process.exit(1);
}

// Transitive dependencies (node-fetch@2 -> whatwg-url -> tr46, and jsonld@4 -> request ->
// tough-cookie) still require Node's deprecated `punycode` module. Node prints that warning
// to stderr on first load, which lands in the middle of an interactive prompt and garbles it.
// Only DeprecationWarnings are silenced; every other warning and error still surfaces.
process.noDeprecation = true;

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
