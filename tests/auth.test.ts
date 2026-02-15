import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../src/credentials.js', () => ({
  readKey: vi.fn(),
  storeKey: vi.fn(),
  getStoreName: vi.fn(() => 'macOS Keychain'),
}));

vi.mock('../src/ui.js', () => {
  const spinner = {
    start: vi.fn(),
    stop: vi.fn(),
  };
  return {
    default: {
      spinner: vi.fn(() => spinner),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
      },
      confirm: vi.fn(),
      password: vi.fn(),
    },
    abortIfCancelled: vi.fn(async (v: unknown) => v),
  };
});

vi.mock('open', () => ({ default: vi.fn() }));

import { verifyKey } from '../src/auth.js';
import { readKey, storeKey } from '../src/credentials.js';

const mockReadKey = vi.mocked(readKey);
const mockStoreKey = vi.mocked(storeKey);

describe('auth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('verifyKey', () => {
    it('returns valid when API responds with 200', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
      } as Response);

      const result = await verifyKey('good-key');
      expect(result.valid).toBe(true);
      expect(result.datasourceCount).toBe(3);
      expect(result.message).toContain('3 data sources');
    });

    it('returns invalid for 401 response', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await verifyKey('bad-key');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('invalid or expired');
    });

    it('returns invalid for other HTTP errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await verifyKey('key');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('HTTP 500');
    });

    it('handles network errors gracefully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await verifyKey('key');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Cannot connect');
    });

    it('handles timeout errors', async () => {
      const mockFetch = vi.mocked(fetch);
      const timeoutError = new Error('timeout');
      timeoutError.name = 'TimeoutError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      const result = await verifyKey('key');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('timed out');
    });

    it('returns singular data source message for count of 1', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1 }],
      } as Response);

      const result = await verifyKey('key');
      expect(result.message).toContain('1 data source available');
      expect(result.message).not.toContain('sources');
    });

    it('handles non-array response body', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      } as Response);

      const result = await verifyKey('key');
      expect(result.valid).toBe(true);
      expect(result.datasourceCount).toBe(0);
    });
  });
});
