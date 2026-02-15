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

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import ui from '../src/ui.js';
import { installSkill, installPlugin } from '../src/install.js';

const mockSpawnSync = vi.mocked(spawnSync);
const mockExistsSync = vi.mocked(fs.existsSync);

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
      // existsSync returns false → claude binary not found
      // execFileSync throws → which claude fails
      mockExistsSync.mockReturnValue(false);

      const result = await installPlugin();

      expect(result).toBe(false);
      expect(ui.note).toHaveBeenCalledWith(
        expect.stringContaining('/plugin marketplace add'),
        expect.any(String),
      );
    });

    it('runs marketplace add and plugin install when claude CLI exists', async () => {
      mockExistsSync.mockReturnValue(true);
      // marketplace add succeeds, plugin install succeeds
      mockSpawnSync
        .mockReturnValueOnce(okSpawn())
        .mockReturnValueOnce(okSpawn());

      const result = await installPlugin();

      expect(result).toBe(true);
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'claude',
        ['plugin', 'marketplace', 'add', expect.stringContaining('CodeAlive')],
        expect.any(Object),
      );
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'claude',
        ['plugin', 'install', 'codealive@codealive-marketplace'],
        expect.any(Object),
      );
    });

    it('shows fallback instructions when marketplace add fails', async () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValueOnce(failSpawn(1, 'network error'));

      const result = await installPlugin();

      expect(result).toBe(false);
      expect(ui.note).toHaveBeenCalled();
    });

    it('handles already-installed plugin gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      // marketplace add succeeds
      mockSpawnSync.mockReturnValueOnce(okSpawn());
      // plugin install fails with "already" in stderr
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
