import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from './base.js';
import type { MCPServerConfig } from '../types.js';
import { MCP_COMMAND, MCP_ARGS } from '../constants.js';

export class ClineClient extends MCPClient {
  name = 'Cline';
  docsUrl = 'https://docs.cline.bot/mcp/configuring-mcp-servers';

  async isClientSupported(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    const suffix = path.join(
      'Code',
      'User',
      'globalStorage',
      'saoudrizwan.claude-dev',
      'settings',
      'cline_mcp_settings.json',
    );

    if (process.platform === 'darwin') {
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        suffix,
      );
    }
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || '', suffix);
    }
    // Linux
    return path.join(os.homedir(), '.config', suffix);
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }

  getServerConfig(apiKey: string): MCPServerConfig {
    const env: Record<string, string> = { CODEALIVE_API_KEY: apiKey };
    const baseUrl = process.env.CODEALIVE_BASE_URL;
    if (baseUrl) {
      env.CODEALIVE_BASE_URL = baseUrl;
    }
    return {
      command: MCP_COMMAND,
      args: [...MCP_ARGS],
      env,
      disabled: false,
    };
  }
}
