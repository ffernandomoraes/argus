// Padrão mínimo de código do monorepo. Foco: arquivos curtos e de uma responsabilidade só
// (mais fáceis de ler, por gente e por IA), nomes previsíveis e estilo único.
// Roda com `pnpm lint` (ou `pnpm lint:fix` para corrigir o que for automático).
// O typescript@6 da raiz existe só para o ESLint: o TS 7 dos apps não tem a API em JavaScript que o
// typescript-eslint usa. O typecheck de cada app continua no TS 7.
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Limites de tamanho. Passou disso, divida o arquivo/função por responsabilidade.
const MAX_FILE_LINES = 400;
const MAX_FUNCTION_LINES = 120;

const namingConvention = [
  'error',
  { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow', trailingUnderscore: 'allow' },
  // Constantes de módulo (UPPER_CASE) e componentes React / schemas (PascalCase).
  { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allowSingleOrDouble', trailingUnderscore: 'allowDouble' },
  // Parâmetro em PascalCase: componente recebido como prop (ex.: `{ icon: Icon }`).
  { selector: 'parameter', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
  // PascalCase só para componentes React.
  { selector: 'function', format: ['camelCase', 'PascalCase'] },
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
  // Chaves de objeto e propriedades costumam vir de fora (JSON, cabeçalhos HTTP, APIs): não checar.
  { selector: ['objectLiteralProperty', 'objectLiteralMethod', 'typeProperty', 'typeMethod'], format: null },
  { selector: 'import', format: null },
  // Descartados de propósito: `_`, `__`.
  { selector: ['variable', 'parameter'], filter: { regex: '^_+$', match: true }, format: null },
  // Nomes entre aspas (ex.: 'Content-Type') e desestruturação de dados externos ficam livres.
  { selector: 'default', modifiers: ['requiresQuotes'], format: null },
  { selector: 'variable', modifiers: ['destructured'], format: null },
  { selector: 'parameter', modifiers: ['destructured'], format: null },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/out/**',
      '**/dist/**',
      '**/build/**',
      '**/.wrangler/**',
      '**/worker-configuration.d.ts',
      'apps/relay/public/**',
      'apps/desktop/native/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { '@stylistic': stylistic, 'react-hooks': reactHooks },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // Tamanho: arquivos e funções curtos, uma responsabilidade cada.
      'max-lines': ['error', { max: MAX_FILE_LINES, skipBlankLines: true, skipComments: false }],
      'max-lines-per-function': ['warn', { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 4],
      complexity: ['warn', 20],

      // Variáveis: const por padrão, let só quando reatribui, nunca var.
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],

      // Nomes: camelCase, tipos e componentes em PascalCase, constantes em UPPER_CASE.
      '@typescript-eslint/naming-convention': namingConvention,
      // Código em inglês: identificadores só com ASCII (pega acentos de nomes em português).
      'id-match': ['error', '^[A-Za-z0-9_$]+$', { properties: false, onlyDeclarations: true }],

      // Estilo.
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/no-extra-semi': 'error',
      '@stylistic/semi-style': ['error', 'last'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/eol-last': 'error',
      '@stylistic/no-trailing-spaces': 'error',

      // Boas práticas.
      // Regex com caracteres de controle é comum aqui (códigos de cor do terminal, \x1b).
      'no-control-regex': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',

      // React.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Testes podem ser mais longos (muitos casos no mesmo arquivo) e logar.
    files: ['**/*.test.{ts,tsx}', '**/test/**'],
    rules: {
      'max-lines': ['error', { max: 800, skipBlankLines: true }],
      'max-lines-per-function': 'off',
      'no-console': 'off',
      // Mocks e dados de teste imitam nomes de fora (ex.: task_id).
      '@typescript-eslint/naming-convention': 'off',
    },
  },
  {
    // Scripts de build escrevem no terminal.
    files: ['**/scripts/**'],
    rules: { 'no-console': 'off' },
  },
  {
    // Arquivos que já passavam do limite quando o ESLint entrou (2026-11-13). Ficam como aviso até
    // serem divididos; ao dividir um, tire-o desta lista. Não acrescente arquivos novos aqui.
    files: [
      'apps/desktop/src/main/auth/index.ts',
      'apps/desktop/src/main/chats/index.ts',
      'apps/desktop/src/main/chats/session.ts',
      'apps/desktop/src/main/terminals/drawerShells.ts',
      'apps/desktop/src/main/usageMonitor/monitor.ts',
      'apps/desktop/src/renderer/src/canvas/mascot/MascotFigure.tsx',
      'apps/desktop/src/renderer/src/canvas/mascot/look.ts',
      'apps/desktop/src/renderer/src/settings/sections/MascotEditor.tsx',
      'apps/website/script.js',
      'packages/shared/src/api.ts',
    ],
    rules: { 'max-lines': ['warn', { max: MAX_FILE_LINES, skipBlankLines: true }] },
  },
);
