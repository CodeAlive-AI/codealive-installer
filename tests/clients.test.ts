import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(() => {
    throw new Error('not found');
  }),
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
import {
  getAllClients,
  findBinary,
  findClaudeBinary,
  ClaudeCodeClient,
} from '../src/clients.js';

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFile = vi.mocked(fs.promises.readFile);
const mockWriteFile = vi.mocked(fs.promises.writeFile);
const mockExecFileSync = vi.mocked(execFileSync);

describe('clients', () => {
  beforeEach(() => {
    mockExistsSync.mockReturnValue(false);
    mockExecFileSync.mockImplementation(() => {
      throw new Error('not found');
    });
  });

  describe('getAllClients', () => {
    it('returns all 10 clients', () => {
      const clients = getAllClients();
      expect(clients).toHaveLength(10);
      expect(clients.map((c) => c.name)).toEqual([
        'Claude Code',
        'Cursor',
        'VS Code',
        'Windsurf',
        'Cline',
        'Roo Code',
        'Zed',
        'OpenCode',
        'Codex',
        'Antigravity',
      ]);
    });
  });

  describe('findBinary', () => {
    it('returns candidate path when file exists', () => {
      mockExistsSync.mockReturnValueOnce(true);
      expect(findBinary('test', ['/usr/bin/test'])).toBe('/usr/bin/test');
    });

    it('falls back to which/where when no candidate exists', () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFileSync.mockReturnValueOnce(Buffer.from('/usr/bin/test'));
      expect(findBinary('test', [])).toBe('test');
    });

    it('returns null when binary not found anywhere', () => {
      mockExistsSync.mockReturnValue(false);
      mockExecFileSync.mockImplementation(() => {
        throw new Error('not found');
      });
      expect(findBinary('test', [])).toBeNull();
    });
  });

  describe('findClaudeBinary', () => {
    it('returns null when claude is not installed', () => {
      expect(findClaudeBinary()).toBeNull();
    });

    it('returns path when claude exists on disk', () => {
      mockExistsSync.mockImplementation((p) => {
        return String(p).includes('.claude/local/claude');
      });
      expect(findClaudeBinary()).toContain('.claude/local/claude');
    });
  });

  describe('ClaudeCodeClient', () => {
    it('detects support when binary exists', async () => {
      mockExistsSync.mockReturnValue(true);
      const client = new ClaudeCodeClient();
      expect(await client.isClientSupported()).toBe(true);
    });

    it('detects not supported when binary missing', async () => {
      const client = new ClaudeCodeClient();
      expect(await client.isClientSupported()).toBe(false);
    });

    it('checks server via mcp list', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockReturnValueOnce(
        Buffer.from('codealive  user  local'),
      );
      const client = new ClaudeCodeClient();
      await client.isClientSupported();
      expect(await client.isServerInstalled()).toBe(true);
    });

    it('adds server via claude mcp add', async () => {
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

  describe('JSON-config clients (via Cursor)', () => {
    // Use getAllClients to get a Cursor instance
    function getCursor() {
      return getAllClients().find((c) => c.name === 'Cursor')!;
    }

    it('isServerInstalled returns false for non-existent config', async () => {
      expect(await getCursor().isServerInstalled()).toBe(false);
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
      expect(await getCursor().isServerInstalled()).toBe(true);
    });

    it('addServer writes correct config', async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await getCursor().addServer('test-key');
      expect(result.success).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledOnce();

      const written = mockWriteFile.mock.calls[0][1] as string;
      const parsed = JSON.parse(written);
      expect(parsed.mcpServers.codealive).toBeDefined();
      expect(parsed.mcpServers.codealive.command).toBe('uvx');
      expect(parsed.mcpServers.codealive.env.CODEALIVE_API_KEY).toBe(
        'test-key',
      );
    });

    it('addServer preserves existing entries', async () => {
      const existing = JSON.stringify(
        { mcpServers: { other: { command: 'node', args: ['s.js'] } } },
        null,
        2,
      );
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(existing);

      const result = await getCursor().addServer('key');
      expect(result.success).toBe(true);
      const parsed = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(parsed.mcpServers.other).toBeDefined();
      expect(parsed.mcpServers.codealive).toBeDefined();
    });
  });

  describe('VS Code', () => {
    function getVSCode() {
      return getAllClients().find((c) => c.name === 'VS Code')!;
    }

    it('writes type: stdio in config', async () => {
      mockExistsSync.mockReturnValue(false);
      await getVSCode().addServer('key');
      const parsed = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(parsed.servers.codealive.type).toBe('stdio');
    });
  });

  describe('Cline', () => {
    function getCline() {
      return getAllClients().find((c) => c.name === 'Cline')!;
    }

    it('writes disabled: false in config', async () => {
      mockExistsSync.mockReturnValue(false);
      await getCline().addServer('key');
      const parsed = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(parsed.mcpServers.codealive.disabled).toBe(false);
    });
  });

  describe('Roo Code', () => {
    function getRooCode() {
      return getAllClients().find((c) => c.name === 'Roo Code')!;
    }

    it('writes disabled: false in config', async () => {
      mockExistsSync.mockReturnValue(false);
      await getRooCode().addServer('key');
      const parsed = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(parsed.mcpServers.codealive.disabled).toBe(false);
    });
  });

  describe('Zed', () => {
    function getZed() {
      return getAllClients().find((c) => c.name === 'Zed')!;
    }

    it('writes source: custom in config', async () => {
      mockExistsSync.mockReturnValue(false);
      await getZed().addServer('key');
      const parsed = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(parsed.context_servers.codealive.source).toBe('custom');
    });

    it('is not supported on windows', async () => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(await getZed().isClientSupported()).toBe(false);
      Object.defineProperty(process, 'platform', { value: original });
    });
  });

  describe('OpenCode', () => {
    function getOpenCode() {
      return getAllClients().find((c) => c.name === 'OpenCode')!;
    }

    it('uses mcp property with custom format', async () => {
      mockExistsSync.mockReturnValue(false);
      await getOpenCode().addServer('key');
      const parsed = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      const server = parsed.mcp.codealive;
      expect(server.type).toBe('local');
      expect(server.command).toContain('uvx');
      expect(server.enabled).toBe(true);
      expect(server.environment.CODEALIVE_API_KEY).toBe('key');
    });
  });

  describe('Antigravity', () => {
    function getAntigravity() {
      return getAllClients().find((c) => c.name === 'Antigravity')!;
    }

    it('writes standard mcpServers config', async () => {
      mockExistsSync.mockReturnValue(false);
      await getAntigravity().addServer('key');
      const parsed = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(parsed.mcpServers.codealive.command).toBe('uvx');
      expect(parsed.mcpServers.codealive.env.CODEALIVE_API_KEY).toBe('key');
    });
  });

  describe('Codex', () => {
    function getCodex() {
      return getAllClients().find((c) => c.name === 'Codex')!;
    }

    it('is not supported when codex binary missing', async () => {
      expect(await getCodex().isClientSupported()).toBe(false);
    });

    it('is supported when codex binary exists', async () => {
      mockExecFileSync.mockReturnValueOnce(Buffer.from('/usr/bin/codex'));
      expect(await getCodex().isClientSupported()).toBe(true);
    });
  });

  describe('CODEALIVE_BASE_URL env', () => {
    it('includes base URL in env when set', async () => {
      const original = process.env.CODEALIVE_BASE_URL;
      process.env.CODEALIVE_BASE_URL = 'https://self-hosted.example.com';

      mockExistsSync.mockReturnValue(false);
      const cursor = getAllClients().find((c) => c.name === 'Cursor')!;
      await cursor.addServer('key');
      const parsed = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(parsed.mcpServers.codealive.env.CODEALIVE_BASE_URL).toBe(
        'https://self-hosted.example.com',
      );

      if (original === undefined) {
        delete process.env.CODEALIVE_BASE_URL;
      } else {
        process.env.CODEALIVE_BASE_URL = original;
      }
    });
  });
});
