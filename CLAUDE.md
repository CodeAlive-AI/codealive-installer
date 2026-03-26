# CodeAlive Installer

Node CLI package managed with `pnpm`.

## Dependency Rules

- Keep `packageManager` pinned in `package.json`.
- Direct dependencies and devDependencies should use exact versions.
- Update `pnpm-lock.yaml` together with `package.json`.
- Verify dependency changes with `pnpm install --frozen-lockfile`.
