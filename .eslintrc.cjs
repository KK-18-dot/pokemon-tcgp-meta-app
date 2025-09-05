module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    // 基本的なルール設定
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-empty-function': 'warn',
    'no-console': 'off', // コンソール出力を許可
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': 'error',
  },
  env: {
    node: true,
    es6: true,
  },
};