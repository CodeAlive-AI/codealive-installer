import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
  execFileSync: vi.fn(() => {
    throw new Error('not found');
  }),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    promises: {
      ...actual.promises,
      mkdir: vi.fn(async () => undefined),
      readFile: vi.fn(async () => '{}'),
      writeFile: vi.fn(async () => undefined),
    },
  };
});

vi.mock('../src/ui.js', () => {
  const spinner = { start: vi.fn(), stop: vi.fn() };
  return {
    default: {
      spinner: vi.fn(() => spinner),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
      },
      multiselect: vi.fn(),
      confirm: vi.fn(),
      note: vi.fn(),
    },
    abortIfCancelled: vi.fn(async (v: unknown) => v),
  };
});

vi.mock('../src/clients.js', async () => {
  const actual =
    await vi.importActual<typeof import('../src/clients.js')>(
      '../src/clients.js',
    );
  return {
    ...actual,
    findClaudeBinary: vi.fn(() => null),
  };
});

import { spawnSync } from 'child_process';
import ui from '../src/ui.js';
import { findClaudeBinary } from '../src/clients.js';
import { installSkill, installPlugin } from '../src/install.js';

const mockSpawnSync = vi.mocked(spawnSync);
const mockFindClaudeBinary = vi.mocked(findClaudeBinary);

function okSpawn() {
  return {
    status: 0,
    pid: 0,
    output: [],
    stdout: Buffer.from(''),
    stderr: Buffer.from(''),
    signal: null,
  } as ReturnType<typeof spawnSync>;
}

function failSpawn(code = 1, stderr = '') {
  return {
    status: code,
    pid: 0,
    output: [],
    stdout: Buffer.from(''),
    stderr: Buffer.from(stderr),
    signal: null,
  } as ReturnType<typeof spawnSync>;
}

describe('install', () => {
  describe('installSkill', () => {
    it('spawns npx skills add with correct repo', () => {
      mockSpawnSync.mockReturnValueOnce(okSpawn());

      const result = installSkill();

      expect(result.success).toBe(true);
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'npx',
        ['skills', 'add', expect.stringContaining('CodeAlive-AI')],
        expect.objectContaining({ shell: true }),
      );
    });

    it('returns error on non-zero exit', () => {
      mockSpawnSync.mockReturnValueOnce(failSpawn(1));

      const result = installSkill();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Exit code 1');
    });

    it('returns error message on spawn error', () => {
      mockSpawnSync.mockReturnValueOnce({
        ...failSpawn(),
        status: null,
        error: new Error('ENOENT'),
      } as ReturnType<typeof spawnSync>);

      const result = installSkill();
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });
  });

  describe('installPlugin', () => {
    it('shows manual instructions when claude CLI is not found', async () => {
      mockFindClaudeBinary.mockReturnValue(null);

      const result = await installPlugin();

      expect(result).toBe(false);
      expect(ui.note).toHaveBeenCalledWith(
        expect.stringContaining('/plugin marketplace add'),
        expect.any(String),
      );
    });

    it('runs marketplace add and plugin install when claude CLI exists', async () => {
      mockFindClaudeBinary.mockReturnValue('/usr/local/bin/claude');
      mockSpawnSync
        .mockReturnValueOnce(okSpawn())
        .mockReturnValueOnce(okSpawn());

      const result = await installPlugin();

      expect(result).toBe(true);
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'claude',
        [
          'plugin',
          'marketplace',
          'add',
          expect.stringContaining('CodeAlive'),
        ],
        expect.any(Object),
      );
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'claude',
        ['plugin', 'install', 'codealive@codealive-marketplace'],
        expect.any(Object),
      );
    });

    it('shows fallback instructions when marketplace add fails', async () => {
      mockFindClaudeBinary.mockReturnValue('/usr/local/bin/claude');
      mockSpawnSync.mockReturnValueOnce(failSpawn(1, 'network error'));

      const result = await installPlugin();

      expect(result).toBe(false);
      expect(ui.note).toHaveBeenCalled();
    });

    it('handles already-installed plugin gracefully', async () => {
      mockFindClaudeBinary.mockReturnValue('/usr/local/bin/claude');
      mockSpawnSync.mockReturnValueOnce(okSpawn());
      mockSpawnSync.mockReturnValueOnce(
        failSpawn(1, 'plugin already installed'),
      );

      const result = await installPlugin();

      expect(result).toBe(true);
      expect(ui.log.success).toHaveBeenCalledWith(
        expect.stringContaining('already installed'),
      );
    });
  });
});
