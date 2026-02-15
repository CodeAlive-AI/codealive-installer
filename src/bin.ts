#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { runWizard } from './wizard.js';

const cli = yargs(hideBin(process.argv))
  .scriptName('codealive-installer')
  .usage('$0 [options]')
  .command(
    '$0',
    'Install CodeAlive MCP server and skill to your coding agents',
    (yargs) =>
      yargs
        .option('api-key', {
          type: 'string',
          alias: 'k',
          description: 'CodeAlive API key',
        })
        .option('debug', {
          type: 'boolean',
          default: false,
          description: 'Enable debug logging',
        })
        .option('ci', {
          type: 'boolean',
          default: false,
          description: 'CI mode — skip prompts, install MCP to detected agents',
        }),
    async (argv) => {
      try {
        await runWizard({
          apiKey: argv['api-key'],
          debug: argv.debug,
          ci: argv.ci,
        });
      } catch (error) {
        console.error('Error:', error);
        process.exit(1);
      }
    },
  )
  .help()
  .version()
  .strict();

cli.parse();
