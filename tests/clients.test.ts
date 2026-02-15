import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      promises: {
        ...actual.promises,
        mkdir: vi.fn(async () => undefined),
        readFile: vi.fn(async () => '{}'),
        writeFile: vi.fn(async () => undefined),
      },
    },
    existsSync: vi.fn(() => false),
    promises: {
      ...actual.promises,
      mkdir: vi.fn(async () => undefined),
      readFile: vi.fn(async () => '{}'),
      writeFile: vi.fn(async () => undefined),
    },
  };
});

import * as fs from 'fs';
import { execFileSync } from 'child_process';
import { CursorClient } from '../src/clients/cursor.js';
import { VSCodeClient } from '../src/clients/vscode.js';
import { WindsurfClient } from '../src/clients/windsurf.js';
import { ClineClient } from '../src/clients/cline.js';
import { ZedClient } from '../src/clients/zed.js';
import { ClaudeCodeClient } from '../src/clients/claude-code.js';
import { getAllClients } from '../src/clients/index.js';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFile = vi.mocked(fs.promises.readFile);
const mockWriteFile = vi.mocked(fs.promises.writeFile);
const mockMkdir = vi.mocked(fs.promises.mkdir);
const mockExecFileSync = vi.mocked(execFileSync);

describe('clients', () => {
  beforeEach(() => {
    mockExistsSync.mockReturnValue(false);
  });

  describe('CursorClient', () => {
    it('returns correct config path on macOS', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const client = new CursorClient();
      const configPath = await client.getConfigPath();
      expect(configPath).toContain('.cursor');
      expect(configPath).toContain('mcp.json');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns correct config path on linux', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const client = new CursorClient();
      const configPath = await client.getConfigPath();
      expect(configPath).toContain('.config/cursor/mcp.json');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns correct config path on windows', async () => {
      const originalPlatform = process.platform;
      const originalAppdata = process.env.APPDATA;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.APPDATA = 'C:\\Users\\test\\AppData\\Roaming';

      const client = new CursorClient();
      const configPath = await client.getConfigPath();
      expect(configPath).toContain('Cursor');
      expect(configPath).toContain('mcp.json');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
      process.env.APPDATA = originalAppdata;
    });

    it('uses mcpServers property', () => {
      const client = new CursorClient();
      expect(client.getServerPropertyName()).toBe('mcpServers');
    });

    it('generates correct server config', () => {
      const client = new CursorClient();
      const config = client.getServerConfig('test-key');
      expect(config).toHaveProperty('command', 'uvx');
      expect(config).toHaveProperty('args');
      expect(config.args as string[]).toContain('codealive-mcp');
      expect(config).toHaveProperty('env');
      expect(
        (config.env as Record<string, string>).CODEALIVE_API_KEY,
      ).toBe('test-key');
    });
  });

  describe('VSCodeClient', () => {
    it('uses servers property (not mcpServers)', () => {
      const client = new VSCodeClient();
      expect(client.getServerPropertyName()).toBe('servers');
    });

    it('includes type: stdio in server config', () => {
      const client = new VSCodeClient();
      const config = client.getServerConfig('key');
      expect(config).toHaveProperty('type', 'stdio');
    });

    it('returns correct config path on macOS', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const client = new VSCodeClient();
      const configPath = await client.getConfigPath();
      expect(configPath).toContain('Application Support');
      expect(configPath).toContain('Code');
      expect(configPath).toContain('mcp.json');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('WindsurfClient', () => {
    it('returns correct config path on macOS', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const client = new WindsurfClient();
      const configPath = await client.getConfigPath();
      expect(configPath).toContain('.codeium');
      expect(configPath).toContain('windsurf');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('ClineClient', () => {
    it('returns correct config path referencing VS Code globalStorage', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const client = new ClineClient();
      const configPath = await client.getConfigPath();
      expect(configPath).toContain('globalStorage');
      expect(configPath).toContain('saoudrizwan.claude-dev');
      expect(configPath).toContain('cline_mcp_settings.json');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('includes disabled: false in server config', () => {
      const client = new ClineClient();
      const config = client.getServerConfig('key');
      expect(config).toHaveProperty('disabled', false);
    });
  });

  describe('ZedClient', () => {
    it('uses context_servers property', () => {
      const client = new ZedClient();
      expect(client.getServerPropertyName()).toBe('context_servers');
    });

    it('includes source: custom in server config', () => {
      const client = new ZedClient();
      const config = client.getServerConfig('key');
      expect(config).toHaveProperty('source', 'custom');
    });

    it('is not supported on windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const client = new ZedClient();
      expect(await client.isClientSupported()).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('ClaudeCodeClient', () => {
    it('is CLI-based', () => {
      const client = new ClaudeCodeClient();
      expect(client.usesCLI).toBe(true);
    });

    it('detects support when claude binary exists on disk', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockReturnValue(Buffer.from('1.0.0'));

      const client = new ClaudeCodeClient();
      const supported = await client.isClientSupported();
      expect(supported).toBe(true);
    });

    it('detects not supported when claude binary is missing', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFileSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const client = new ClaudeCodeClient();
      const supported = await client.isClientSupported();
      expect(supported).toBe(false);
    });

    it('checks server installation via claude mcp list', async () => {
      mockExistsSync.mockReturnValue(true);
      // existsSync finds binary on disk, so no execFileSync for isClientSupported.
      // isServerInstalled calls execFileSync with 'mcp list'.
      mockExecFileSync.mockReturnValueOnce(
        Buffer.from('codealive  user  local'),
      );

      const client = new ClaudeCodeClient();
      await client.isClientSupported();
      const installed = await client.isServerInstalled();
      expect(installed).toBe(true);
    });

    it('adds server using claude mcp add command', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockReturnValue(Buffer.from(''));

      const client = new ClaudeCodeClient();
      await client.isClientSupported();
      const result = await client.addServer('my-key');

      expect(result.success).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'mcp',
          'add',
          'codealive',
          '-e',
          'CODEALIVE_API_KEY=my-key',
        ]),
        expect.any(Object),
      );
    });
  });

  describe('getAllClients', () => {
    it('returns all 6 clients', () => {
      const clients = getAllClients();
      expect(clients).toHaveLength(6);
      expect(clients.map((c) => c.name)).toEqual([
        'Claude Code',
        'Cursor',
        'VS Code',
        'Windsurf',
        'Cline',
        'Zed',
      ]);
    });
  });

  describe('MCPClient base (via CursorClient)', () => {
    it('isServerInstalled returns false for non-existent config', async () => {
      mockExistsSync.mockReturnValue(false);

      const client = new CursorClient();
      expect(await client.isServerInstalled()).toBe(false);
    });

    it('isServerInstalled returns true when codealive entry exists', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          mcpServers: {
            codealive: { command: 'uvx', args: ['codealive-mcp'] },
          },
        }),
      );

      const client = new CursorClient();
      expect(await client.isServerInstalled()).toBe(true);
    });

    it('addServer creates config file with correct structure', async () => {
      mockExistsSync.mockReturnValue(false);

      const client = new CursorClient();
      const result = await client.addServer('test-key');

      expect(result.success).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledOnce();

      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.mcpServers.codealive).toBeDefined();
      expect(parsed.mcpServers.codealive.command).toBe('uvx');
      expect(parsed.mcpServers.codealive.env.CODEALIVE_API_KEY).toBe(
        'test-key',
      );
    });

    it('addServer preserves existing config entries', async () => {
      const existingConfig = JSON.stringify(
        {
          mcpServers: {
            other: { command: 'node', args: ['server.js'] },
          },
        },
        null,
        2,
      );

      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(existingConfig);

      const client = new CursorClient();
      const result = await client.addServer('key');

      expect(result.success).toBe(true);

      const written = mockWriteFile.mock.calls[0][1] as string;
      const parsed = JSON.parse(written);
      expect(parsed.mcpServers.other).toBeDefined();
      expect(parsed.mcpServers.codealive).toBeDefined();
    });

    it('removeServer removes codealive entry', async () => {
      const config = JSON.stringify(
        {
          mcpServers: {
            codealive: { command: 'uvx', args: ['codealive-mcp'] },
            other: { command: 'node', args: ['server.js'] },
          },
        },
        null,
        2,
      );

      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(config);

      const client = new CursorClient();
      const result = await client.removeServer();

      expect(result.success).toBe(true);
      const written = mockWriteFile.mock.calls[0][1] as string;
      const parsed = JSON.parse(written);
      expect(parsed.mcpServers.codealive).toBeUndefined();
      expect(parsed.mcpServers.other).toBeDefined();
    });

    it('includes CODEALIVE_BASE_URL in env when set', () => {
      const originalBaseUrl = process.env.CODEALIVE_BASE_URL;
      process.env.CODEALIVE_BASE_URL = 'https://self-hosted.example.com';

      const client = new CursorClient();
      const config = client.getServerConfig('key');
      expect(
        (config.env as Record<string, string>).CODEALIVE_BASE_URL,
      ).toBe('https://self-hosted.example.com');

      if (originalBaseUrl === undefined) {
        delete process.env.CODEALIVE_BASE_URL;
      } else {
        process.env.CODEALIVE_BASE_URL = originalBaseUrl;
      }
    });
  });
});
