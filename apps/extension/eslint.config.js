import js from '@eslint/js';
import globals from 'globals';

// Regras de dependencia entre camadas: presentation/entrypoints -> application -> domain;
// infrastructure implementa portas e so conhece domain.
const forbid = (...groups) => ({
    'no-restricted-imports': ['error', {
        patterns: groups.map(([group, message]) => ({ group, message }))
    }]
});

export default [
    { ignores: ['dist/**', 'node_modules/**'] },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module'
        },
        rules: {
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            eqeqeq: ['warn', 'smart'],
            'prefer-const': 'warn',
            'no-var': 'error'
        }
    },
    {
        files: ['src/domain/**/*.js'],
        languageOptions: { globals: { URL: 'readonly', console: 'readonly' } },
        rules: forbid(
            [['**/application/**', '**/infrastructure/**', '**/presentation/**', '**/entrypoints/**'],
                'domain deve ser puro: nao importa outras camadas.']
        )
    },
    {
        files: ['src/application/**/*.js'],
        languageOptions: { globals: { URL: 'readonly', console: 'readonly' } },
        rules: forbid(
            [['**/infrastructure/**', '**/presentation/**', '**/entrypoints/**'],
                'application depende de domain e de portas injetadas, nunca de infrastructure/presentation.']
        )
    },
    {
        files: ['src/infrastructure/**/*.js'],
        languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
        rules: forbid(
            [['**/application/**', '**/presentation/**', '**/entrypoints/**'],
                'infrastructure so pode depender de domain.']
        )
    },
    {
        files: ['src/entrypoints/**/*.js'],
        languageOptions: { globals: { ...globals.serviceworker, ...globals.webextensions } },
        rules: forbid([['**/presentation/**'], 'entrypoints nao dependem de presentation.'])
    },
    {
        files: ['src/presentation/**/*.js'],
        languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
        rules: forbid(
            [['**/entrypoints/**', '**/infrastructure/ai/**', '**/infrastructure/boards/**', '**/infrastructure/backend/**'],
                'presentation fala com o backend apenas via mensagens ao background.']
        )
    },
    {
        files: ['scripts/**/*.mjs', 'tests/**/*.js', 'eslint.config.js', 'vite.config.mjs'],
        languageOptions: { globals: globals.node }
    }
];
