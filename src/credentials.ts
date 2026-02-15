import { execFileSync } from 'child_process';
import * as os from 'os';
import { SERVICE_NAME } from './constants.js';
import { debug } from './debug.js';

/**
 * Read API key from environment variable or OS credential store.
 */
export function readKey(): string | null {
  const envKey = process.env.CODEALIVE_API_KEY;
  if (envKey) {
    debug('Found API key in CODEALIVE_API_KEY env var');
    return envKey;
  }

  const platform = process.platform;

  if (platform === 'darwin') {
    try {
      const result = execFileSync(
        'security',
        [
          'find-generic-password',
          '-a',
          os.userInfo().username,
          '-s',
          SERVICE_NAME,
          '-w',
        ],
        { stdio: 'pipe', timeout: 5000 },
      );
      const key = result.toString().trim();
      if (key) {
        debug('Found API key in macOS Keychain');
        return key;
      }
    } catch {
      debug('No key in macOS Keychain');
    }
  }

  if (platform === 'linux') {
    try {
      const result = execFileSync(
        'secret-tool',
        ['lookup', 'service', SERVICE_NAME],
        { stdio: 'pipe', timeout: 5000 },
      );
      const key = result.toString().trim();
      if (key) {
        debug('Found API key in secret-tool');
        return key;
      }
    } catch {
      debug('No key in secret-tool');
    }
  }

  if (platform === 'win32') {
    try {
      const result = execFileSync(
        'powershell',
        [
          '-Command',
          `(Get-StoredCredential -Target '${SERVICE_NAME}').GetNetworkCredential().Password`,
        ],
        { stdio: 'pipe', timeout: 5000 },
      );
      const key = result.toString().trim();
      if (key) {
        debug('Found API key in Windows Credential Manager');
        return key;
      }
    } catch {
      debug('No key in Windows Credential Manager');
    }
  }

  return null;
}

/**
 * Store API key in the OS credential store.
 */
export function storeKey(apiKey: string): boolean {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      // Delete existing entry first (ignore errors)
      try {
        execFileSync(
          'security',
          [
            'delete-generic-password',
            '-a',
            os.userInfo().username,
            '-s',
            SERVICE_NAME,
          ],
          { stdio: 'pipe', timeout: 5000 },
        );
      } catch {
        // May not exist — that's fine
      }

      execFileSync(
        'security',
        [
          'add-generic-password',
          '-a',
          os.userInfo().username,
          '-s',
          SERVICE_NAME,
          '-w',
          apiKey,
        ],
        { stdio: 'pipe', timeout: 5000 },
      );
      debug('Stored key in macOS Keychain');
      return true;
    }

    if (platform === 'linux') {
      execFileSync(
        'secret-tool',
        ['store', '--label=CodeAlive API Key', 'service', SERVICE_NAME],
        { input: apiKey, stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 },
      );
      debug('Stored key in secret-tool');
      return true;
    }

    if (platform === 'win32') {
      execFileSync(
        'cmdkey',
        [`/generic:${SERVICE_NAME}`, '/user:codealive', `/pass:${apiKey}`],
        { stdio: 'pipe', timeout: 10000 },
      );
      debug('Stored key in Windows Credential Manager');
      return true;
    }
  } catch (error) {
    debug(`Failed to store key: ${error}`);
    return false;
  }

  return false;
}

/**
 * Human-readable name of the credential store for the current platform.
 */
export function getStoreName(): string {
  switch (process.platform) {
    case 'darwin':
      return 'macOS Keychain';
    case 'linux':
      return 'secret-tool';
    case 'win32':
      return 'Windows Credential Manager';
    default:
      return 'credential store';
  }
}
