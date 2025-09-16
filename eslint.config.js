import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginTs from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginNext from '@next/eslint-plugin-next';
import pluginPrettier from 'eslint-plugin-prettier';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  // Special config for Worker app
  {
    files: ['apps/worker/**/*.ts'],
    ignores: ['node_modules', 'dist', '*.test.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        tsconfigRootDir: __dirname,
        project: ['apps/worker/tsconfig.json'],
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
        // Cloudflare Worker globals
        KVNamespace: 'readonly',
        R2Bucket: 'readonly',
        D1Database: 'readonly',
        DurableObjectNamespace: 'readonly',
        Ai: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        HTMLRewriter: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': pluginTs,
      prettier: pluginPrettier,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...pluginTs.configs.recommended.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
        allowBoolean: true,
        allowNullish: true,
      }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  // Config for Web app and other files
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: ['node_modules', 'dist', '.next', '*.config.js', 'apps/worker/**/*'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json', 'apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        // Cloudflare Worker globals
        KVNamespace: 'readonly',
        R2Bucket: 'readonly',
        D1Database: 'readonly',
        DurableObjectNamespace: 'readonly',
        Ai: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        HTMLRewriter: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': pluginTs,
      react: pluginReact,
      'react-hooks': pluginReactHooks,
      '@next/next': pluginNext,
      prettier: pluginPrettier,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...pluginTs.configs['strict-type-checked'].rules,
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
      '@next/next/no-html-link-for-pages': 'off',
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
    settings: {
      react: {
        version: 'detect',
      },
      next: {
        rootDir: ['apps/web'],
      },
    },
  },
];
