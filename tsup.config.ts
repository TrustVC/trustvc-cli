import { defineConfig } from 'tsup';

export default defineConfig([
  {
    dts: false,
    sourcemap: false,
    treeshake: true,
    splitting: false,
    clean: true,
    legacyOutput: true,
    outDir: 'dist',
    platform: 'neutral',
    entry: ['src/**/*.ts', '!tests/**/*.{test,spec}.ts'],
    format: ['cjs'],
    tsconfig: 'tsconfig.build.json',
    shims: false,
    bundle: false,
    minify: false,
    keepNames: true,
    // outExtension,
  },
]);
