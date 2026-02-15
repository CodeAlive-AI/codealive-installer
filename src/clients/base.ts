import * as fs from 'fs';
import * as path from 'path';
import * as jsonc from 'jsonc-parser';
import {
  MCP_SERVER_NAME,
  MCP_COMMAND,
  MCP_ARGS,
  APP_URL,
} from '../constants.js';
import { debug } from '../debug.js';
import type { InstallResult, MCPServerConfig } from '../types.js';

/**
 * Abstract base class for coding agent MCP clients.
 * Ported from nia-wizard's MCPClient with CodeAlive-specific config.
 */
export abstract class MCPClient {
  abstract name: string;
  abstract getConfigPath(): Promise<string>;
  abstract getServerPropertyName(): string;
  abstract isClientSupported(): Promise<boolean>;

  docsUrl?: string;
  usesCLI = false;

  /**
   * Build the CodeAlive MCP server config for this client.
   */
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
    };
  }

  /**
   * Check if the CodeAlive MCP server is already configured.
   */
  async isServerInstalled(): Promise<boolean> {
    try {
      const configPath = await this.getConfigPath();
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

  /**
   * Add the CodeAlive MCP server to this client's config.
   */
  async addServer(apiKey: string): Promise<InstallResult> {
    try {
      const configPath = await this.getConfigPath();
      const configDir = path.dirname(configPath);

      await fs.promises.mkdir(configDir, { recursive: true });

      let configContent = '';
      if (fs.existsSync(configPath)) {
        configContent = await fs.promises.readFile(configPath, 'utf8');
      }

      const serverConfig = this.getServerConfig(apiKey);

      const edits = jsonc.modify(
        configContent,
        [this.getServerPropertyName(), MCP_SERVER_NAME],
        serverConfig,
        { formattingOptions: { tabSize: 2, insertSpaces: true } },
      );

      const modified = jsonc.applyEdits(configContent, edits);
      await fs.promises.writeFile(configPath, modified, 'utf8');

      debug(`Wrote config to ${configPath}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debug(`Failed to add server to ${this.name}: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Remove the CodeAlive MCP server from this client's config.
   */
  async removeServer(): Promise<InstallResult> {
    try {
      const configPath = await this.getConfigPath();
      if (!fs.existsSync(configPath)) {
        return { success: false, error: 'Config file not found' };
      }

      const content = await fs.promises.readFile(configPath, 'utf8');
      const edits = jsonc.modify(
        content,
        [this.getServerPropertyName(), MCP_SERVER_NAME],
        undefined,
        { formattingOptions: { tabSize: 2, insertSpaces: true } },
      );

      const modified = jsonc.applyEdits(content, edits);
      await fs.promises.writeFile(configPath, modified, 'utf8');

      debug(`Removed server from ${configPath}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}
