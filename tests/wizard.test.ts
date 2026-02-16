import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('../src/ui.js', () => {
  const spinner = { start: vi.fn(), stop: vi.fn() };
  return {
    default: {
      intro: vi.fn(),
      outro: vi.fn(),
      spinner: vi.fn(() => spinner),
      note: vi.fn(),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        message: vi.fn(),
      },
      multiselect: vi.fn(),
      confirm: vi.fn(),
      password: vi.fn(),
      select: vi.fn(),
    },
    abortIfCancelled: vi.fn(async (v: unknown) => v),
  };
});

vi.mock('../src/auth.js', () => ({
  getApiKey: vi.fn(async () => 'test-api-key'),
  getApiKeyCi: vi.fn(async () => 'ci-api-key'),
  verifyKey: vi.fn(async () => ({
    valid: true,
    message: 'Connected.',
    datasourceCount: 1,
  })),
}));

vi.mock('../src/install.js', () => ({
  installMcp: vi.fn(async () => ['Cursor']),
  installSkill: vi.fn(() => ({ success: true })),
  installPlugin: vi.fn(async () => true),
}));

import ui from '../src/ui.js';
import { getApiKey, getApiKeyCi } from '../src/auth.js';
import { installMcp, installSkill, installPlugin } from '../src/install.js';
import { runWizard } from '../src/wizard.js';

const mockMultiselect = vi.mocked(ui.multiselect);
const mockGetApiKey = vi.mocked(getApiKey);
const mockGetApiKeyCi = vi.mocked(getApiKeyCi);
const mockInstallMcp = vi.mocked(installMcp);
const mockInstallSkill = vi.mocked(installSkill);
const mockInstallPlugin = vi.mocked(installPlugin);

describe('wizard', () => {
  it('installs plugin when selected', async () => {
    mockMultiselect.mockResolvedValueOnce(['plugin']);

    await runWizard({});

    expect(mockInstallPlugin).toHaveBeenCalled();
    expect(mockInstallSkill).not.toHaveBeenCalled();
    expect(mockInstallMcp).not.toHaveBeenCalled();
  });

  it('installs skill when selected', async () => {
    mockMultiselect.mockResolvedValueOnce(['skill']);

    await runWizard({});

    expect(mockGetApiKey).toHaveBeenCalled();
    expect(mockInstallSkill).toHaveBeenCalled();
    expect(mockInstallPlugin).not.toHaveBeenCalled();
  });

  it('installs MCP when selected', async () => {
    mockMultiselect.mockResolvedValueOnce(['mcp']);

    await runWizard({});

    expect(mockGetApiKey).toHaveBeenCalled();
    expect(mockInstallMcp).toHaveBeenCalledWith('test-api-key', {
      ci: undefined,
    });
    expect(mockInstallSkill).not.toHaveBeenCalled();
  });

  it('installs all three when all selected', async () => {
    mockMultiselect.mockResolvedValueOnce(['plugin', 'skill', 'mcp']);

    await runWizard({});

    expect(mockInstallPlugin).toHaveBeenCalled();
    expect(mockInstallSkill).toHaveBeenCalled();
    expect(mockGetApiKey).toHaveBeenCalled();
    expect(mockInstallMcp).toHaveBeenCalled();
  });

  it('runs plugin before skill before MCP', async () => {
    const callOrder: string[] = [];
    mockInstallPlugin.mockImplementation(async () => {
      callOrder.push('plugin');
      return true;
    });
    mockInstallSkill.mockImplementation(() => {
      callOrder.push('skill');
      return { success: true };
    });
    mockInstallMcp.mockImplementation(async () => {
      callOrder.push('mcp');
      return ['Cursor'];
    });

    mockMultiselect.mockResolvedValueOnce(['plugin', 'skill', 'mcp']);
    await runWizard({});

    expect(callOrder).toEqual(['plugin', 'skill', 'mcp']);
  });

  it('uses CI auth mode when ci option is set', async () => {
    await runWizard({ ci: true, apiKey: 'provided-key' });

    expect(mockGetApiKeyCi).toHaveBeenCalledWith('provided-key');
    expect(mockInstallMcp).toHaveBeenCalledWith('ci-api-key', { ci: true });
  });

  it('requires auth for any selection', async () => {
    mockMultiselect.mockResolvedValueOnce(['plugin']);

    await runWizard({});

    expect(mockGetApiKey).toHaveBeenCalled();
  });

  it('calls intro and outro', async () => {
    mockMultiselect.mockResolvedValueOnce(['plugin']);

    await runWizard({});

    expect(ui.intro).toHaveBeenCalled();
    expect(ui.outro).toHaveBeenCalled();
  });
});
