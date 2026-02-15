import chalk from 'chalk';
import ui, { abortIfCancelled } from './ui.js';
import { enableDebug } from './debug.js';
import { getApiKey, getApiKeyCi } from './auth.js';
import { installMcp, installSkill, installPlugin } from './install.js';
import type { WizardOptions } from './types.js';

/**
 * Main wizard entry point.
 */
export async function runWizard(options: WizardOptions): Promise<void> {
  if (options.debug) {
    enableDebug();
  }

  console.log('');
  ui.intro(chalk.bgCyan.black(' CodeAlive Installer '));

  // Step 1: What to install
  let actions: string[];

  if (options.ci) {
    actions = ['mcp'];
  } else {
    actions = await abortIfCancelled(
      ui.multiselect({
        message:
          'What would you like to install? (space to select, enter to confirm)',
        options: [
          {
            value: 'plugin',
            label: 'Claude Code Plugin',
            hint: 'Recommended for Claude Code — skill + hooks + subagent',
          },
          {
            value: 'skill',
            label: 'CodeAlive Skill',
            hint: 'Universal — works with Cursor, Copilot, Windsurf, 30+ agents',
          },
          {
            value: 'mcp',
            label: 'CodeAlive MCP Server',
            hint: 'Direct tool access via Model Context Protocol',
          },
        ],
        required: true,
      }),
    );
  }

  // Step 2: Authenticate
  const needsAuth = actions.includes('mcp');
  let apiKey: string | undefined;

  if (needsAuth) {
    apiKey = options.ci
      ? await getApiKeyCi(options.apiKey)
      : await getApiKey(options.apiKey);
  }

  // Step 3: Install components (plugin → skill → MCP)
  let installedPlugin = false;
  let installedSkill = false;
  let installedMcp = false;

  if (actions.includes('plugin')) {
    installedPlugin = await installPlugin();
  }

  if (actions.includes('skill')) {
    console.log('');
    const result = installSkill();
    if (result.success) {
      ui.log.success('CodeAlive skill installed.');
      installedSkill = true;
    } else {
      ui.log.warn(`Skill installation failed: ${result.error}`);
    }
  }

  if (actions.includes('mcp') && apiKey) {
    console.log('');
    const clients = await installMcp(apiKey, { ci: options.ci });
    installedMcp = clients.length > 0;
  }

  // Outro
  if (installedPlugin || installedSkill || installedMcp) {
    const outro = `
${chalk.green('Done!')} Start your coding agent and try:

  ${chalk.yellow('"How is authentication implemented?"')}
  ${chalk.yellow('"Show me error handling patterns across services"')}
  ${chalk.yellow('"Find similar features to guide my implementation"')}

${chalk.dim('Docs:')} ${chalk.cyan('https://app.codealive.ai')}
`;
    ui.outro(outro);
  } else if (actions.includes('plugin')) {
    ui.outro(chalk.dim('Follow the plugin instructions above.'));
  } else {
    ui.outro(chalk.dim('No changes made.'));
  }
}
