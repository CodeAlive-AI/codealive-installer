import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MCPClient } from './base.js';
import { MCP_SERVER_NAME, MCP_COMMAND, MCP_ARGS } from '../constants.js';
import { debug } from '../debug.js';
import type { InstallResult } from '../types.js';

export class ClaudeCodeClient extends MCPClient {
  name = 'Claude Code';
  docsUrl = 'https://docs.anthropic.com/en/docs/claude-code/mcp-servers';
  usesCLI = true;

  private cachedBinary: string | null = null;

  async isClientSupported(): Promise<boolean> {
    return this.findBinary() !== null;
  }

  async getConfigPath(): Promise<string> {
    throw new Error('Claude Code uses CLI for configuration');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  async isServerInstalled(): Promise<boolean> {
    const binary = this.findBinary();
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
    const binary = this.findBinary();
    if (!binary) {
      return { success: false, error: 'Claude Code CLI not found' };
    }

    try {
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
      if (baseUrl) {
        args.splice(4, 0, '-e', `CODEALIVE_BASE_URL=${baseUrl}`);
      }

      debug(`Running: ${binary} ${args.join(' ')}`);
      execFileSync(binary, args, { stdio: 'pipe', timeout: 15000 });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  async removeServer(): Promise<InstallResult> {
    const binary = this.findBinary();
    if (!binary) {
      return { success: false, error: 'Claude Code CLI not found' };
    }

    try {
      execFileSync(
        binary,
        ['mcp', 'remove', '--scope', 'user', MCP_SERVER_NAME],
        { stdio: 'pipe', timeout: 10000 },
      );
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  private findBinary(): string | null {
    if (this.cachedBinary) return this.cachedBinary;

    const home = os.homedir();
    const candidates = [
      path.join(home, '.claude', 'local', 'claude'),
      path.join(home, '.bun', 'bin', 'claude'),
      path.join(home, '.npm', 'bin', 'claude'),
      path.join(home, '.yarn', 'bin', 'claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        debug(`Found claude binary at: ${candidate}`);
        this.cachedBinary = candidate;
        return candidate;
      }
    }

    // Try PATH
    try {
      execFileSync('which', ['claude'], { stdio: 'pipe', timeout: 3000 });
      this.cachedBinary = 'claude';
      return 'claude';
    } catch {
      return null;
    }
  }
}
