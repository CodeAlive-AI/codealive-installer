import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from './base.js';
import type { MCPServerConfig } from '../types.js';
import { MCP_COMMAND, MCP_ARGS } from '../constants.js';

export class ZedClient extends MCPClient {
  name = 'Zed';
  docsUrl = 'https://zed.dev/docs/ai/mcp';

  async isClientSupported(): Promise<boolean> {
    const platform = process.platform;
    if (platform !== 'darwin' && platform !== 'linux') return false;

    const configPath = await this.getConfigPath();
    return fs.existsSync(path.dirname(configPath));
  }

  async getConfigPath(): Promise<string> {
    const xdg = process.env.XDG_CONFIG_HOME;
    if (xdg) {
      return path.join(xdg, 'zed', 'settings.json');
    }
    return path.join(os.homedir(), '.config', 'zed', 'settings.json');
  }

  getServerPropertyName(): string {
    return 'context_servers';
  }

  getServerConfig(apiKey: string): MCPServerConfig {
    const env: Record<string, string> = { CODEALIVE_API_KEY: apiKey };
    const baseUrl = process.env.CODEALIVE_BASE_URL;
    if (baseUrl) {
      env.CODEALIVE_BASE_URL = baseUrl;
    }
    return {
      source: 'custom',
      command: MCP_COMMAND,
      args: [...MCP_ARGS],
      env,
    };
  }
}
