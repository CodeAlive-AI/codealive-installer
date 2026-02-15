import { MCPClient } from './base.js';
import { ClaudeCodeClient } from './claude-code.js';
import { CursorClient } from './cursor.js';
import { VSCodeClient } from './vscode.js';
import { WindsurfClient } from './windsurf.js';
import { ClineClient } from './cline.js';
import { ZedClient } from './zed.js';
import { debug } from '../debug.js';

export { MCPClient } from './base.js';
export { ClaudeCodeClient } from './claude-code.js';
export { CursorClient } from './cursor.js';
export { VSCodeClient } from './vscode.js';
export { WindsurfClient } from './windsurf.js';
export { ClineClient } from './cline.js';
export { ZedClient } from './zed.js';

/**
 * All known MCP clients, ordered by popularity.
 */
export function getAllClients(): MCPClient[] {
  return [
    new ClaudeCodeClient(),
    new CursorClient(),
    new VSCodeClient(),
    new WindsurfClient(),
    new ClineClient(),
    new ZedClient(),
  ];
}

/**
 * Detect which coding agents are installed on this machine.
 */
export async function getSupportedClients(): Promise<MCPClient[]> {
  const all = getAllClients();
  const supported: MCPClient[] = [];

  for (const client of all) {
    const ok = await client.isClientSupported();
    debug(`${client.name}: ${ok ? 'detected' : 'not found'}`);
    if (ok) {
      supported.push(client);
    }
  }

  debug(
    `Found ${supported.length} agent(s): ${supported.map((c) => c.name).join(', ')}`,
  );
  return supported;
}
