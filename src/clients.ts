import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as jsonc from 'jsonc-parser';
import { MCP_SERVER_NAME, MCP_COMMAND, MCP_ARGS } from './constants.js';
import { debug } from './debug.js';
import type { InstallResult, MCPServerConfig } from './types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildEnv(apiKey: string): Record<string, string> {
  const env: Record<string, string> = { CODEALIVE_API_KEY: apiKey };
  const baseUrl = process.env.CODEALIVE_BASE_URL;
  if (baseUrl) env.CODEALIVE_BASE_URL = baseUrl;
  return env;
}

export function findBinary(
  name: string,
  candidates: string[],
): string | null {
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(cmd, [name], { stdio: 'pipe', timeout: 3000 });
    return name;
  } catch {
    return null;
  }
}

export function findClaudeBinary(): string | null {
  const home = os.homedir();
  return findBinary('claude', [
    path.join(home, '.claude', 'local', 'claude'),
    path.join(home, '.bun', 'bin', 'claude'),
    path.join(home, '.npm', 'bin', 'claude'),
    path.join(home, '.yarn', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ]);
}

// ── Abstract base ────────────────────────────────────────────────────────────

export abstract class MCPClient {
  abstract name: string;
  abstract isClientSupported(): Promise<boolean>;
  abstract addServer(apiKey: string): Promise<InstallResult>;

  async isServerInstalled(): Promise<boolean> {
    return false;
  }

  async removeServer(): Promise<InstallResult> {
    return { success: false, error: 'Not implemented' };
  }
}

// ── JSON-config base ─────────────────────────────────────────────────────────

abstract class JsonConfigClient extends MCPClient {
  abstract getConfigPath(): string;
  abstract getServerPropertyName(): string;

  getServerConfig(apiKey: string): MCPServerConfig {
    return { command: MCP_COMMAND, args: [...MCP_ARGS], env: buildEnv(apiKey) };
  }

  async isClientSupported(): Promise<boolean> {
    const dir = path.dirname(this.getConfigPath());
    return fs.existsSync(dir) || fs.existsSync(path.dirname(dir));
  }

  async isServerInstalled(): Promise<boolean> {
    try {
      const configPath = this.getConfigPath();
      if (!fs.existsSync(configPath)) return false;
      const content = await fs.promises.readFile(configPath, 'utf8');
      const config = jsonc.parse(content) as Record<string, unknown>;
      const prop = this.getServerPropertyName();
      return (
        prop in config &&
        typeof config[prop] === 'object' &&
        config[prop] !== null &&
        MCP_SERVER_NAME in (config[prop] as Record<string, unknown>)
      );
    } catch {
      return false;
    }
  }

  async addServer(apiKey: string): Promise<InstallResult> {
    try {
      const configPath = this.getConfigPath();
      await fs.promises.mkdir(path.dirname(configPath), { recursive: true });

      let content = '';
      if (fs.existsSync(configPath)) {
        content = await fs.promises.readFile(configPath, 'utf8');
      }

      const edits = jsonc.modify(
        content,
        [this.getServerPropertyName(), MCP_SERVER_NAME],
        this.getServerConfig(apiKey),
        { formattingOptions: { tabSize: 2, insertSpaces: true } },
      );

      await fs.promises.writeFile(
        configPath,
        jsonc.applyEdits(content, edits),
        'utf8',
      );
      debug(`Wrote config to ${configPath}`);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  async removeServer(): Promise<InstallResult> {
    try {
      const configPath = this.getConfigPath();
      if (!fs.existsSync(configPath)) {
        return { success: false, error: 'Config not found' };
      }
      const content = await fs.promises.readFile(configPath, 'utf8');
      const edits = jsonc.modify(
        content,
        [this.getServerPropertyName(), MCP_SERVER_NAME],
        undefined,
        { formattingOptions: { tabSize: 2, insertSpaces: true } },
      );
      await fs.promises.writeFile(
        configPath,
        jsonc.applyEdits(content, edits),
        'utf8',
      );
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }
}

// ── Cursor ───────────────────────────────────────────────────────────────────

class CursorClient extends JsonConfigClient {
  name = 'Cursor';
  getServerPropertyName() {
    return 'mcpServers';
  }
  getConfigPath() {
    if (process.platform === 'win32')
      return path.join(process.env.APPDATA || '', 'Cursor', 'mcp.json');
    if (process.platform === 'linux')
      return path.join(os.homedir(), '.config', 'cursor', 'mcp.json');
    return path.join(os.homedir(), '.cursor', 'mcp.json');
  }
}

// ── VS Code ──────────────────────────────────────────────────────────────────

class VSCodeClient extends JsonConfigClient {
  name = 'VS Code';
  getServerPropertyName() {
    return 'servers';
  }
  getServerConfig(apiKey: string): MCPServerConfig {
    return {
      type: 'stdio',
      command: MCP_COMMAND,
      args: [...MCP_ARGS],
      env: buildEnv(apiKey),
    };
  }
  getConfigPath() {
    if (process.platform === 'darwin')
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Code',
        'User',
        'mcp.json',
      );
    if (process.platform === 'win32')
      return path.join(process.env.APPDATA || '', 'Code', 'User', 'mcp.json');
    return path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json');
  }
}

// ── Windsurf ─────────────────────────────────────────────────────────────────

class WindsurfClient extends JsonConfigClient {
  name = 'Windsurf';
  getServerPropertyName() {
    return 'mcpServers';
  }
  getConfigPath() {
    if (process.platform === 'darwin')
      return path.join(
        os.homedir(),
        '.codeium',
        'windsurf',
        'mcp_config.json',
      );
    if (process.platform === 'win32')
      return path.join(
        process.env.APPDATA || '',
        'Codeium',
        'windsurf',
        'mcp_config.json',
      );
    return path.join(os.homedir(), '.config', 'windsurf', 'mcp.json');
  }
}

// ── Cline ────────────────────────────────────────────────────────────────────

class ClineClient extends JsonConfigClient {
  name = 'Cline';
  getServerPropertyName() {
    return 'mcpServers';
  }
  getServerConfig(apiKey: string): MCPServerConfig {
    return {
      command: MCP_COMMAND,
      args: [...MCP_ARGS],
      env: buildEnv(apiKey),
      disabled: false,
    };
  }
  getConfigPath() {
    const suffix = path.join(
      'Code',
      'User',
      'globalStorage',
      'saoudrizwan.claude-dev',
      'settings',
      'cline_mcp_settings.json',
    );
    if (process.platform === 'darwin')
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        suffix,
      );
    if (process.platform === 'win32')
      return path.join(process.env.APPDATA || '', suffix);
    return path.join(os.homedir(), '.config', suffix);
  }
}

// ── Roo Code ─────────────────────────────────────────────────────────────────

class RooCodeClient extends JsonConfigClient {
  name = 'Roo Code';
  getServerPropertyName() {
    return 'mcpServers';
  }
  getServerConfig(apiKey: string): MCPServerConfig {
    return {
      command: MCP_COMMAND,
      args: [...MCP_ARGS],
      env: buildEnv(apiKey),
      disabled: false,
    };
  }
  getConfigPath() {
    const suffix = path.join(
      'Code',
      'User',
      'globalStorage',
      'rooveterinaryinc.roo-cline',
      'settings',
      'mcp_settings.json',
    );
    if (process.platform === 'darwin')
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        suffix,
      );
    if (process.platform === 'win32')
      return path.join(process.env.APPDATA || '', suffix);
    return path.join(os.homedir(), '.config', suffix);
  }
}

// ── Zed ──────────────────────────────────────────────────────────────────────

class ZedClient extends JsonConfigClient {
  name = 'Zed';
  getServerPropertyName() {
    return 'context_servers';
  }
  getServerConfig(apiKey: string): MCPServerConfig {
    return {
      source: 'custom',
      command: MCP_COMMAND,
      args: [...MCP_ARGS],
      env: buildEnv(apiKey),
    };
  }
  async isClientSupported() {
    if (process.platform !== 'darwin' && process.platform !== 'linux')
      return false;
    return fs.existsSync(path.dirname(this.getConfigPath()));
  }
  getConfigPath() {
    const xdg = process.env.XDG_CONFIG_HOME;
    if (xdg) return path.join(xdg, 'zed', 'settings.json');
    return path.join(os.homedir(), '.config', 'zed', 'settings.json');
  }
}

// ── OpenCode ─────────────────────────────────────────────────────────────────

class OpenCodeClient extends JsonConfigClient {
  name = 'OpenCode';
  getServerPropertyName() {
    return 'mcp';
  }
  getServerConfig(apiKey: string): MCPServerConfig {
    return {
      type: 'local',
      command: [MCP_COMMAND, ...MCP_ARGS],
      enabled: true,
      environment: buildEnv(apiKey),
    };
  }
  getConfigPath() {
    if (process.platform === 'win32')
      return path.join(
        process.env.APPDATA || '',
        'opencode',
        'opencode.json',
      );
    return path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
  }
}

// ── Antigravity ──────────────────────────────────────────────────────────────

class AntigravityClient extends JsonConfigClient {
  name = 'Antigravity';
  getServerPropertyName() {
    return 'mcpServers';
  }
  getConfigPath() {
    return path.join(
      os.homedir(),
      '.gemini',
      'antigravity',
      'mcp_config.json',
    );
  }
}

// ── Claude Code (CLI) ────────────────────────────────────────────────────────

export class ClaudeCodeClient extends MCPClient {
  name = 'Claude Code';
  private cachedBinary: string | null = null;

  private getBinary(): string | null {
    if (this.cachedBinary) return this.cachedBinary;
    const binary = findClaudeBinary();
    if (binary) this.cachedBinary = binary;
    return binary;
  }

  async isClientSupported() {
    return this.getBinary() !== null;
  }

  async isServerInstalled() {
    const binary = this.getBinary();
    if (!binary) return false;
    try {
      const output = execFileSync(binary, ['mcp', 'list'], {
        stdio: 'pipe',
        timeout: 10000,
      });
      return output.toString().includes(MCP_SERVER_NAME);
    } catch {
      return false;
    }
  }

  async addServer(apiKey: string): Promise<InstallResult> {
    const binary = this.getBinary();
    if (!binary) return { success: false, error: 'Claude Code CLI not found' };
    try {
      // Remove existing entry first for idempotent updates
      try {
        execFileSync(
          binary,
          ['mcp', 'remove', '--scope', 'user', MCP_SERVER_NAME],
          { stdio: 'pipe', timeout: 10000 },
        );
        debug('Removed existing codealive MCP entry');
      } catch {
        // Not installed yet — fine
      }

      const args = [
        'mcp',
        'add',
        MCP_SERVER_NAME,
        '-e',
        `CODEALIVE_API_KEY=${apiKey}`,
        '-s',
        'user',
        '--',
        MCP_COMMAND,
        ...MCP_ARGS,
      ];
      const baseUrl = process.env.CODEALIVE_BASE_URL;
      if (baseUrl) args.splice(4, 0, '-e', `CODEALIVE_BASE_URL=${baseUrl}`);
      debug(`Running: ${binary} ${args.join(' ')}`);
      execFileSync(binary, args, { stdio: 'pipe', timeout: 15000 });
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  async removeServer(): Promise<InstallResult> {
    const binary = this.getBinary();
    if (!binary) return { success: false, error: 'Claude Code CLI not found' };
    try {
      execFileSync(
        binary,
        ['mcp', 'remove', '--scope', 'user', MCP_SERVER_NAME],
        { stdio: 'pipe', timeout: 10000 },
      );
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }
}

// ── Codex (CLI) ──────────────────────────────────────────────────────────────

class CodexClient extends MCPClient {
  name = 'Codex';

  private findCodexBinary(): string | null {
    const home = os.homedir();
    return findBinary('codex', [
      path.join(home, '.npm', 'bin', 'codex'),
      path.join(home, '.bun', 'bin', 'codex'),
      '/usr/local/bin/codex',
      '/opt/homebrew/bin/codex',
    ]);
  }

  async isClientSupported() {
    return this.findCodexBinary() !== null;
  }

  async addServer(apiKey: string): Promise<InstallResult> {
    const binary = this.findCodexBinary();
    if (!binary) return { success: false, error: 'Codex CLI not found' };
    try {
      // Remove existing entry first for idempotent updates
      try {
        execFileSync(binary, ['mcp', 'remove', MCP_SERVER_NAME], {
          stdio: 'pipe',
          timeout: 10000,
        });
        debug('Removed existing codealive MCP entry from Codex');
      } catch {
        // Not installed yet — fine
      }

      const args = [
        'mcp',
        'add',
        MCP_SERVER_NAME,
        '--env',
        `CODEALIVE_API_KEY=${apiKey}`,
      ];
      const baseUrl = process.env.CODEALIVE_BASE_URL;
      if (baseUrl) args.push('--env', `CODEALIVE_BASE_URL=${baseUrl}`);
      args.push('--', MCP_COMMAND, ...MCP_ARGS);
      debug(`Running: ${binary} ${args.join(' ')}`);
      execFileSync(binary, args, { stdio: 'pipe', timeout: 15000 });
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }
}

// ── Registry ─────────────────────────────────────────────────────────────────

export function getAllClients(): MCPClient[] {
  return [
    new ClaudeCodeClient(),
    new CursorClient(),
    new VSCodeClient(),
    new WindsurfClient(),
    new ClineClient(),
    new RooCodeClient(),
    new ZedClient(),
    new OpenCodeClient(),
    new CodexClient(),
    new AntigravityClient(),
  ];
}

export async function getSupportedClients(): Promise<MCPClient[]> {
  const all = getAllClients();
  const supported: MCPClient[] = [];
  for (const client of all) {
    const ok = await client.isClientSupported();
    debug(`${client.name}: ${ok ? 'detected' : 'not found'}`);
    if (ok) supported.push(client);
  }
  return supported;
}
