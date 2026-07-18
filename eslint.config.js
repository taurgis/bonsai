import tseslint from 'typescript-eslint';

/**
 * Greenfield ESLint setup focused on identifier naming.
 * Broader recommended rule packs are intentionally off to avoid a large
 * unrelated cleanup in the same change as naming conventions.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'docs/**',
      '.bonsai/**',
      'coverage/**',
      'node_modules/**',
      'bin/**',
      'agents/**',
      'testing/**',
    ],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Naming-convention format checks do not need type-aware linting.
        // Tests/scripts are excluded from tsconfig.json, so avoid projectService.
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'function',
          format: ['camelCase'],
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['PascalCase', 'UPPER_CASE'],
        },
        // Artifact frontmatter / external payloads may use snake_case.
        {
          selector: 'property',
          format: ['camelCase', 'snake_case', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeProperty',
          format: ['camelCase', 'snake_case', 'UPPER_CASE', 'PascalCase'],
        },
        {
          selector: 'objectLiteralProperty',
          format: null,
        },
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
      ],
    },
  }
);
