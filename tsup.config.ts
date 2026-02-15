import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'node18',
  sourcemap: true,
  dts: true,
  shims: true,
  clean: true,
});
