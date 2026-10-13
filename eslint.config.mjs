import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tailwind from 'eslint-plugin-better-tailwindcss'
import prettier from 'eslint-config-prettier'
import boundaries from './tooling/eslint-boundaries.mjs'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.tanstack/**',
      '.wrangler/**',
      'docs/**',
      'src/routeTree.gen.ts',
      'test-results/**',
      'playwright-report/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      'better-tailwindcss': tailwind,
      architecture: boundaries,
    },
    settings: {
      'better-tailwindcss': {
        entryPoint: 'src/styles.css',
        detectComponentClasses: true,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...tailwind.configs['correctness-error'].rules,
      'architecture/no-ui-data-import': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [
            {
              pattern: '\\[[^\\]]*\\](?!:)',
              message:
                'D-128: arbitrary values are forbidden; use design tokens.',
            },
            {
              pattern: '(^|:)!?animate-',
              message: 'D-129: animation classes are forbidden.',
            },
          ],
        },
      ],
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: [
      'src/components/admin/**/*.tsx',
      'src/routes/admin.tsx',
      'src/routes/admin/**/*.tsx',
    ],
    settings: {
      'better-tailwindcss': {
        entryPoint: 'tooling/admin-lint.css',
        detectComponentClasses: true,
      },
    },
  },
  {
    files: ['src/components/admin-variants.tsx'],
    settings: {
      'better-tailwindcss': {
        entryPoint: 'tooling/admin-variants-lint.css',
        detectComponentClasses: true,
      },
    },
  },
  {
    files: ['src/components/writing-variants.tsx'],
    settings: {
      'better-tailwindcss': {
        entryPoint: 'tooling/writing-variants-lint.css',
        detectComponentClasses: true,
      },
    },
  },
  {
    files: ['src/components/design-catalogue.tsx'],
    settings: {
      'better-tailwindcss': {
        entryPoint: 'tooling/design-catalogue-lint.css',
        detectComponentClasses: true,
      },
    },
  },
  prettier,
)
