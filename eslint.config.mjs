import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

/**
 * REGLA DE DEPENDENCIA (ARCHITECTURE AUDIT §6)
 *
 *   UI ──► APPLICATION ──► DOMAIN ◄── INFRASTRUCTURE
 *
 * Las dependencias apuntan siempre hacia adentro. Un layering que solo existe
 * en un documento se degrada en tres semanas: aqui se impone en CI.
 */
const LAYER_RULES = [
  {
    name: 'domain',
    files: ['src/domain/**/*.ts', 'src/domain/**/*.tsx'],
    forbidden: [
      { group: ['react', 'react-dom', 'next', 'next/*'], message: 'domain/ es TypeScript puro: no puede depender de React ni de Next.' },
      { group: ['dexie', 'dexie-react-hooks', '@supabase/*'], message: 'domain/ no puede depender de una implementacion de persistencia. Define un puerto en application/ports.' },
      { group: ['@ui/*', '@/ui/*', '@application/*', '@/application/*', '@infrastructure/*', '@/infrastructure/*'], message: 'domain/ es la capa mas interna: no puede importar de capas externas.' },
    ],
  },
  {
    name: 'application',
    files: ['src/application/**/*.ts', 'src/application/**/*.tsx'],
    forbidden: [
      { group: ['react', 'react-dom', 'next', 'next/*'], message: 'application/ no puede depender de React ni de Next.' },
      { group: ['dexie', 'dexie-react-hooks', '@supabase/*'], message: 'application/ depende de puertos (interfaces), nunca de implementaciones concretas.' },
      { group: ['@ui/*', '@/ui/*', '@infrastructure/*', '@/infrastructure/*'], message: 'application/ no puede importar de ui/ ni de infrastructure/.' },
    ],
  },
  {
    name: 'infrastructure',
    files: ['src/infrastructure/**/*.ts', 'src/infrastructure/**/*.tsx'],
    forbidden: [
      { group: ['@ui/*', '@/ui/*'], message: 'infrastructure/ no puede importar de ui/.' },
    ],
  },
  {
    name: 'ui',
    files: ['src/ui/**/*.ts', 'src/ui/**/*.tsx'],
    forbidden: [
      { group: ['@infrastructure/remote/*', '@/infrastructure/remote/*'], message: 'ui/ no accede al backend directamente. Usa un caso de uso de application/.' },
      { group: ['@supabase/supabase-js'], message: 'ui/ no instancia clientes de backend. El unico camino de escritura es application/ -> /api/sync.' },
    ],
  },
];

const layerConfigs = LAYER_RULES.map((layer) => ({
  name: `boundaries/${layer.name}`,
  files: layer.files,
  rules: {
    'no-restricted-imports': ['error', { patterns: layer.forbidden }],
  },
}));

export default tseslint.config(
  // `test-results/` guarda los rastros de Playwright, que son bundles de la
  // propia aplicación minificados. Sin esta línea, correr los E2E y después
  // `npm run lint` devuelve ~6.700 errores de código que no escribimos.
  // Estaba en `.gitignore` pero no acá: dos listas que decían cosas distintas.
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'coverage/**',
      'public/sw.js',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...nextCoreWebVitals,
  ...tseslint.configs.recommended,
  {
    name: 'project/base',
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  ...layerConfigs,
  {
    // Los scripts de build SON herramientas de linea de comandos: informar por
    // consola es su trabajo, no un descuido.
    name: 'project/scripts',
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
  {
    name: 'project/tests',
    files: ['tests/**/*.ts', 'tests/**/*.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-imports': 'off',
    },
  },
);
