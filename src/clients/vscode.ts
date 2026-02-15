import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from './base.js';
import type { MCPServerConfig } from '../types.js';
import { MCP_COMMAND, MCP_ARGS } from '../constants.js';

export class VSCodeClient extends MCPClient {
  name = 'VS Code';
  docsUrl = 'https://code.visualstudio.com/docs/copilot/chat/mcp-servers';

  async isClientSupported(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    if (process.platform === 'darwin') {
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Code',
        'User',
        'mcp.json',
      );
    }
    if (process.platform === 'win32') {
      return path.join(
        process.env.APPDATA || '',
        'Code',
        'User',
        'mcp.json',
      );
    }
    // Linux
    return path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json');
  }

  getServerPropertyName(): string {
    return 'servers';
  }

  getServerConfig(apiKey: string): MCPServerConfig {
    const env: Record<string, string> = { CODEALIVE_API_KEY: apiKey };
    const baseUrl = process.env.CODEALIVE_BASE_URL;
    if (baseUrl) {
      env.CODEALIVE_BASE_URL = baseUrl;
    }
    return {
      type: 'stdio',
      command: MCP_COMMAND,
      args: [...MCP_ARGS],
      env,
    };
  }
}
