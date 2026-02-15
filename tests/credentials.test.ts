import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';

// Mock child_process before importing module under test
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'child_process';
import { readKey, storeKey, getStoreName } from '../src/credentials.js';

const mockExecFileSync = vi.mocked(execFileSync);

describe('credentials', () => {
  beforeEach(() => {
    delete process.env.CODEALIVE_API_KEY;
  });

  describe('readKey', () => {
    it('returns env var when CODEALIVE_API_KEY is set', () => {
      process.env.CODEALIVE_API_KEY = 'test-key-123';
      expect(readKey()).toBe('test-key-123');
      expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it('returns key from macOS Keychain on darwin', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockExecFileSync.mockReturnValueOnce(Buffer.from('keychain-key\n'));

      const key = readKey();
      expect(key).toBe('keychain-key');
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'security',
        expect.arrayContaining(['find-generic-password']),
        expect.any(Object),
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns key from secret-tool on linux', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      mockExecFileSync.mockReturnValueOnce(Buffer.from('linux-key\n'));

      const key = readKey();
      expect(key).toBe('linux-key');
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'secret-tool',
        expect.arrayContaining(['lookup']),
        expect.any(Object),
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns null when no key is found anywhere', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockExecFileSync.mockImplementation(() => {
        throw new Error('not found');
      });

      expect(readKey()).toBeNull();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns null on unsupported platform', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'freebsd' });

      expect(readKey()).toBeNull();

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('storeKey', () => {
    it('stores key in macOS Keychain on darwin', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockExecFileSync.mockReturnValue(Buffer.from(''));

      const result = storeKey('my-api-key');
      expect(result).toBe(true);

      // Should call delete first, then add
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'security',
        expect.arrayContaining(['delete-generic-password']),
        expect.any(Object),
      );
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'security',
        expect.arrayContaining(['add-generic-password', '-w', 'my-api-key']),
        expect.any(Object),
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('stores key via secret-tool on linux', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      mockExecFileSync.mockReturnValue(Buffer.from(''));

      const result = storeKey('linux-key');
      expect(result).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'secret-tool',
        expect.arrayContaining(['store']),
        expect.objectContaining({ input: 'linux-key' }),
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('stores key via cmdkey on windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      mockExecFileSync.mockReturnValue(Buffer.from(''));

      const result = storeKey('win-key');
      expect(result).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'cmdkey',
        expect.arrayContaining(['/pass:win-key']),
        expect.any(Object),
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns false when store command fails', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockExecFileSync.mockImplementation(() => {
        throw new Error('permission denied');
      });

      const result = storeKey('key');
      expect(result).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns false on unsupported platform', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'freebsd' });

      const result = storeKey('key');
      expect(result).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('getStoreName', () => {
    it('returns macOS Keychain for darwin', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(getStoreName()).toBe('macOS Keychain');
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns secret-tool for linux', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(getStoreName()).toBe('secret-tool');
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns Windows Credential Manager for win32', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(getStoreName()).toBe('Windows Credential Manager');
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });
});
