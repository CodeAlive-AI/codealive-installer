import chalk from 'chalk';
import open from 'open';
import ui, { abortIfCancelled } from './ui.js';
import { readKey, storeKey, getStoreName } from './credentials.js';
import { API_KEYS_URL, VERIFY_ENDPOINT } from './constants.js';
import { debug } from './debug.js';
import type { VerifyResult } from './types.js';

/**
 * Verify an API key against the CodeAlive API.
 */
export async function verifyKey(apiKey: string): Promise<VerifyResult> {
  try {
    const response = await fetch(VERIFY_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, message: 'API key is invalid or expired.' };
      }
      return {
        valid: false,
        message: `API returned HTTP ${response.status}.`,
      };
    }

    const data = await response.json();
    const count = Array.isArray(data) ? data.length : 0;
    return {
      valid: true,
      message: `Connected. ${count} data source${count !== 1 ? 's' : ''} available.`,
      datasourceCount: count,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { valid: false, message: 'Connection timed out.' };
    }
    const msg = error instanceof Error ? error.message : String(error);
    return { valid: false, message: `Cannot connect: ${msg}` };
  }
}

/**
 * Get a valid API key — from argument, credential store, or interactive prompt.
 */
export async function getApiKey(providedKey?: string): Promise<string> {
  // 1. Provided via CLI argument
  if (providedKey) {
    const spinner = ui.spinner();
    spinner.start('Verifying provided API key...');
    const result = await verifyKey(providedKey);
    if (result.valid) {
      spinner.stop(`Key verified. ${result.message}`);
      await ensureStored(providedKey);
      return providedKey;
    }
    spinner.stop('Provided key is invalid.');
    ui.log.warn(result.message);
  }

  // 2. Already stored in credential store
  const existing = readKey();
  if (existing) {
    const spinner = ui.spinner();
    spinner.start('Checking stored API key...');
    const result = await verifyKey(existing);
    if (result.valid) {
      spinner.stop(`Stored key is valid. ${result.message}`);
      return existing;
    }
    spinner.stop('Stored key is no longer valid.');
    ui.log.warn(result.message);
  }

  // 3. Interactive: open browser and ask user to paste
  return await promptForApiKey();
}

/**
 * Non-interactive variant: verify and store a key, or exit with error.
 */
export async function getApiKeyCi(providedKey?: string): Promise<string> {
  const key = providedKey ?? readKey();
  if (!key) {
    ui.log.error(
      'No API key found. Pass --api-key or set CODEALIVE_API_KEY env var.',
    );
    process.exit(1);
  }

  const result = await verifyKey(key);
  if (!result.valid) {
    ui.log.error(`API key verification failed: ${result.message}`);
    process.exit(1);
  }

  ui.log.success(`Key verified. ${result.message}`);
  await ensureStored(key);
  return key;
}

async function promptForApiKey(): Promise<string> {
  ui.log.info('You need a CodeAlive API key to continue.');

  const shouldOpen = await abortIfCancelled(
    ui.confirm({
      message: `Open ${chalk.cyan(API_KEYS_URL)} in your browser?`,
      initialValue: true,
    }),
  );

  if (shouldOpen) {
    try {
      await open(API_KEYS_URL);
      ui.log.info('Browser opened. Copy your API key from the page.');
    } catch {
      ui.log.warn(
        `Could not open browser. Go to: ${chalk.cyan(API_KEYS_URL)}`,
      );
    }
  } else {
    ui.log.info(`Get your key at: ${chalk.cyan(API_KEYS_URL)}`);
  }

  const apiKey = await abortIfCancelled(
    ui.password({
      message: 'Paste your API key:',
      validate: (value) => {
        if (!value.trim()) return 'API key is required.';
        return undefined;
      },
    }),
  );

  const trimmed = apiKey.trim();

  // Verify
  const spinner = ui.spinner();
  spinner.start('Verifying API key...');
  const result = await verifyKey(trimmed);

  if (!result.valid) {
    spinner.stop('Verification failed.');
    ui.log.error(result.message);
    process.exit(1);
  }

  spinner.stop(`Verified! ${result.message}`);
  await ensureStored(trimmed);
  return trimmed;
}

async function ensureStored(apiKey: string): Promise<void> {
  const stored = storeKey(apiKey);
  if (stored) {
    ui.log.success(`Key saved to ${getStoreName()}.`);
  } else {
    debug('Could not save to credential store');
  }
}
