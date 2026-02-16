# codealive-installer

Install [CodeAlive](https://docs.codealive.ai) to your AI coding agents.

Supports three installation methods:

| Method | Best for | Agents |
|--------|----------|--------|
| **Claude Code Plugin** | Claude Code users | Claude Code |
| **CodeAlive Skill** | Universal use | Cursor, Copilot, Windsurf, Gemini CLI, Codex, Roo Code, 30+ agents |
| **MCP Server** | Direct tool access | Any MCP-compatible client |

## Quick Start

**macOS / Linux:**

```bash
npx @codealive/installer
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/CodeAlive-AI/codealive-installer/main/install.ps1 | iex
```

Or if you already have Node.js:

```powershell
npx @codealive/installer
```

The interactive wizard will guide you through selecting and installing components.

## Options

```
--api-key, -k   CodeAlive API key
--ci             CI mode — skip prompts, install MCP to detected agents
--debug          Enable debug logging
```

### CI Mode

```bash
npx @codealive/installer --ci --api-key YOUR_KEY
```

Automatically installs the MCP server to all detected agents without prompts.

## Supported Agents (MCP)

- Claude Code
- Cursor
- VS Code (GitHub Copilot)
- Windsurf
- Cline
- Roo Code
- Zed
- OpenCode
- Codex
- Antigravity

## Programmatic Usage

```typescript
import { runWizard, installMcp, installSkill, installPlugin } from '@codealive/installer';

// Run the full wizard
await runWizard({ apiKey: 'your-key' });

// Or install individual components
const mcpClients = await installMcp('your-key');
const skillResult = installSkill();
const pluginOk = await installPlugin();
```

## API Key

Get your API key at [app.codealive.ai/settings/api-keys](https://app.codealive.ai/settings/api-keys).

Keys are stored in the OS credential store (macOS Keychain, Linux secret-tool, Windows Credential Manager).

## License

MIT
