import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const config = {
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // Exclude playbook-scaffold contract tests that use node:test (tsx --test)
    // instead of vitest. Vitest can't run them; they show as 'No test suite found'.
    // If you want to run them: \`npx tsx --test lib/<file>.test.ts\`.
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      'vendor/openreel/**',
      'lib/detect-api-adapter.test.ts',
      'lib/detect-contract.test.ts',
      'lib/divine-action-applier.test.ts',
      'lib/divine-action-contract.test.ts',
      'lib/editor-panel-state.test.ts',
      'lib/editor-project.test.ts',
      'lib/editor-shell-state.test.ts',
      'lib/editor-view.test.ts',
      'lib/export-contract.test.ts',
      'lib/feature-flags.test.ts',
      'lib/provider-signing-contract.test.ts',
    ],
    pool: 'threads',
    maxConcurrency: 1,
  },
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
}

export default config
