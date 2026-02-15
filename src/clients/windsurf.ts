import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { MCPClient } from './base.js';

export class WindsurfClient extends MCPClient {
  name = 'Windsurf';
  docsUrl = 'https://docs.windsurf.com/windsurf/cascade/mcp';

  async isClientSupported(): Promise<boolean> {
    const configPath = await this.getConfigPath();
    const configDir = path.dirname(configPath);
    return fs.existsSync(configDir) || fs.existsSync(path.dirname(configDir));
  }

  async getConfigPath(): Promise<string> {
    if (process.platform === 'darwin') {
      return path.join(
        os.homedir(),
        '.codeium',
        'windsurf',
        'mcp_config.json',
      );
    }
    if (process.platform === 'win32') {
      return path.join(
        process.env.APPDATA || '',
        'Codeium',
        'windsurf',
        'mcp_config.json',
      );
    }
    // Linux
    return path.join(os.homedir(), '.config', 'windsurf', 'mcp.json');
  }

  getServerPropertyName(): string {
    return 'mcpServers';
  }
}
