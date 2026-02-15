import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from './base.js';

export class CursorClient extends MCPClient {
  name = 'Cursor';
  docsUrl = 'https://cursor.com/docs/context/mcp';

  async isClientSupported(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(path.dirname(configDir)) || fs.existsSync(configDir);
  }

  async getConfigPath(): Promise<string> {
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || '', 'Cursor', 'mcp.json');
    }
    if (process.platform === 'linux') {
      return path.join(os.homedir(), '.config', 'cursor', 'mcp.json');
    }
    // macOS
    return path.join(os.homedir(), '.cursor', 'mcp.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }
}
