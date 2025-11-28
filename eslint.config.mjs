import { createRequire } from 'module'
import tseslint from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tailwindcss from 'eslint-plugin-tailwindcss'
import neostandard from 'neostandard'

const require = createRequire(import.meta.url)
const localRules = require('./eslint-local-rules.cjs')

export default [
  // Ignore build outputs and config files
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'eslint.config.mjs',
      'vite.config.ts',
      'postcss.config.js',
      'tailwind.config.js'
    ]
  },

  // neostandard base configuration (with TypeScript support)
  ...neostandard({ ts: true }),

  // Chrome extension specific configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'simple-import-sort': simpleImportSort,
      tailwindcss,
      local: { rules: localRules }
    },
    rules: {
      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Import sorting
      'simple-import-sort/imports': 'error',

      // TypeScript type imports (enforce separate type imports)
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: false,
          fixStyle: 'separate-type-imports'
        }
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // カスタムルール: インライン型アノテーションを禁止
      'local/no-inline-type-imports': 'error',

      // JSX quotes (use single quotes to match neostandard)
      '@stylistic/jsx-quotes': ['error', 'prefer-single'],

      // Tailwind CSS
      'tailwindcss/classnames-order': 'warn',
      'tailwindcss/no-custom-classname': 'warn'
    },
    settings: {
      tailwindcss: {
        callees: ['classnames', 'clsx', 'ctl', 'cva', 'tv', 'twMerge']
      }
    }
  }
]
