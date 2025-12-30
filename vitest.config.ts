import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    'import.meta.vitest': 'undefined',
  },
  plugins: [],
  cacheDir: './node_modules/.vitest',
  test: {
    include: ['tests/**/*.test.{ts,js}'],
    exclude: ['dist', 'node_modules', '*/type{s}.{ts,js}'],
    coverage: {
      enabled: false,
      provider: 'v8',
      reportsDirectory: '.coverage',
      ignoreEmptyLines: true,
      reporter: ['text', 'lcov', 'json', 'html'],
      include: ['src/**/*.{ts,js}'],
    },
  },
});
