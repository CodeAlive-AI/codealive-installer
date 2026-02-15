export const APP_URL =
  process.env.CODEALIVE_BASE_URL || 'https://app.codealive.ai';

export const API_KEYS_URL = `${APP_URL}/settings/api-keys`;

export const VERIFY_ENDPOINT = `${APP_URL}/api/datasources/alive`;

export const SERVICE_NAME = 'codealive-api-key';

export const MCP_SERVER_NAME = 'codealive';

export const MCP_COMMAND = 'uvx';

export const MCP_ARGS = ['codealive-mcp'];

export const SKILL_REPO =
  'CodeAlive-AI/codealive-skills@codealive-context-engine';

export const PLUGIN_REPO = 'CodeAlive-AI/codealive-skills';
