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
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    ignores: ['node_modules', 'dist', '.next', '*.config.js'],
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
    },
  },
];
