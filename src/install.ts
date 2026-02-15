import { spawnSync } from 'child_process';
import chalk from 'chalk';
import ui, { abortIfCancelled } from './ui.js';
import { getAllClients, type MCPClient } from './clients/index.js';
import { SKILL_REPO, PLUGIN_REPO } from './constants.js';
import { debug } from './debug.js';
import type { InstallResult } from './types.js';

/**
 * Detect supported agents, let user pick, and install MCP server to each.
 */
export async function installMcp(
  apiKey: string,
  options: { ci?: boolean } = {},
): Promise<string[]> {
  const allClients = getAllClients();
  const supportedNames = new Set<string>();

  for (const client of allClients) {
    if (await client.isClientSupported()) {
      supportedNames.add(client.name);
    }
  }

  let selectedClients: MCPClient[];

  if (options.ci) {
    selectedClients = allClients.filter((c) => supportedNames.has(c.name));
    if (selectedClients.length === 0) {
      ui.log.warn('No coding agents detected on this system.');
      return [];
    }
    ui.log.info(
      `Auto-selecting: ${selectedClients.map((c) => c.name).join(', ')}`,
    );
  } else {
    const selectedNames = await abortIfCancelled(
      ui.multiselect({
        message: 'Select coding agents to install CodeAlive MCP to:',
        options: allClients.map((client) => ({
          value: client.name,
          label: client.name,
          hint: supportedNames.has(client.name)
            ? 'detected'
            : 'not detected',
        })),
        initialValues: allClients
          .filter((c) => supportedNames.has(c.name))
          .map((c) => c.name),
        required: false,
      }),
    );

    selectedClients = allClients.filter((c) =>
      selectedNames.includes(c.name),
    );
  }

  if (selectedClients.length === 0) {
    ui.log.info('No agents selected.');
    return [];
  }

  // Check for existing installations
  if (!options.ci) {
    const installed: MCPClient[] = [];
    for (const client of selectedClients) {
      if (await client.isServerInstalled()) {
        installed.push(client);
      }
    }

    if (installed.length > 0) {
      ui.log.warn(
        `CodeAlive already configured for:\n  ${installed.map((c) => `- ${c.name}`).join('\n  ')}`,
      );

      const reinstall = await abortIfCancelled(
        ui.confirm({
          message: 'Reinstall to update configuration?',
          initialValue: true,
        }),
      );

      if (!reinstall) {
        selectedClients = selectedClients.filter(
          (c) => !installed.includes(c),
        );
        if (selectedClients.length === 0) {
          ui.log.info('Nothing to install.');
          return [];
        }
      }
    }
  }

  // Install
  const spinner = ui.spinner();
  spinner.start('Installing CodeAlive MCP server...');

  const succeeded: string[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const client of selectedClients) {
    const result = await client.addServer(apiKey);
    if (result.success) {
      succeeded.push(client.name);
    } else {
      failed.push({
        name: client.name,
        error: result.error || 'Unknown error',
      });
    }
  }

  spinner.stop('Installation complete.');

  if (succeeded.length > 0) {
    ui.log.success(
      `Installed to:\n  ${succeeded.map((n) => `${chalk.green('+')} ${n}`).join('\n  ')}`,
    );
  }

  if (failed.length > 0) {
    ui.log.warn(
      `Failed:\n  ${failed.map((f) => `${chalk.red('x')} ${f.name}: ${f.error}`).join('\n  ')}`,
    );
  }

  return succeeded;
}

/**
 * Install CodeAlive skill via npx skills add.
 */
export function installSkill(): InstallResult {
  ui.log.info('Installing CodeAlive skill...');

  const result = spawnSync('npx', ['skills', 'add', SKILL_REPO], {
    stdio: 'inherit',
    shell: true,
    timeout: 120000,
  });

  if (result.status === 0) {
    return { success: true };
  }

  return {
    success: false,
    error: result.error?.message || `Exit code ${result.status}`,
  };
}

/**
 * Install Claude Code plugin (marketplace add + plugin install).
 * Falls back to showing manual instructions if claude CLI is not available.
 */
export async function installPlugin(): Promise<boolean> {
  console.log('');

  // Try to find claude binary
  const { ClaudeCodeClient } = await import('./clients/claude-code.js');
  const claude = new ClaudeCodeClient();
  const hasClaudeCli = await claude.isClientSupported();

  if (!hasClaudeCli) {
    ui.note(
      `Run these commands inside Claude Code:\n\n` +
        `  /plugin marketplace add ${PLUGIN_REPO}\n` +
        `  /plugin install codealive@codealive-marketplace`,
      'Claude Code Plugin',
    );
    return false;
  }

  const spinner = ui.spinner();
  spinner.start('Adding CodeAlive plugin marketplace...');

  // Step 1: marketplace add
  const addResult = spawnSync(
    'claude',
    ['plugin', 'marketplace', 'add', PLUGIN_REPO],
    { stdio: 'pipe', shell: true, timeout: 30000 },
  );

  if (addResult.status !== 0) {
    spinner.stop('Marketplace add failed.');
    const stderr = addResult.stderr?.toString().trim();
    if (stderr && stderr.includes('already')) {
      ui.log.info('Marketplace already added.');
    } else {
      ui.log.warn(
        `Could not add marketplace automatically.${stderr ? ` ${stderr}` : ''}`,
      );
      ui.note(
        `Run these commands inside Claude Code:\n\n` +
          `  /plugin marketplace add ${PLUGIN_REPO}\n` +
          `  /plugin install codealive@codealive-marketplace`,
        'Manual Installation',
      );
      return false;
    }
  }

  // Step 2: plugin install
  const installResult = spawnSync(
    'claude',
    ['plugin', 'install', 'codealive@codealive-marketplace'],
    { stdio: 'pipe', shell: true, timeout: 30000 },
  );

  if (installResult.status !== 0) {
    spinner.stop('Plugin install failed.');
    const stderr = installResult.stderr?.toString().trim();
    if (stderr && stderr.includes('already')) {
      ui.log.success('Claude Code plugin already installed.');
      return true;
    }
    ui.log.warn(
      `Could not install plugin automatically.${stderr ? ` ${stderr}` : ''}`,
    );
    ui.note(
      `Run this command inside Claude Code:\n\n` +
        `  /plugin install codealive@codealive-marketplace`,
      'Manual Installation',
    );
    return false;
  }

  spinner.stop('Claude Code plugin installed.');
  ui.log.success(
    'Installed CodeAlive plugin with skill, auth hooks, and code explorer subagent.',
  );
  return true;
}
