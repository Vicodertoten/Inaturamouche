module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: ['eslint:recommended'],
  ignorePatterns: [
    'client/**',
    'node_modules/**',
    'wiki/**',
    'docs/**',
    'server/packs/index.js',
  ],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-constant-condition': 'off',
    'no-console': 'off',
  },
};
