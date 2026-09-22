import { defineConfig, devices } from '@playwright/test';

/**
 * E2E (MASTER SPEC §58)
 *
 * Los flujos que definen el producto: crear un personaje, jugar una sesión y
 * seguir funcionando sin conexión. Si estos pasan, la aplicación sirve.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    // Permite apuntar a un servidor ya levantado —por ejemplo el build de
    // producción— sin tocar el archivo. Las capturas lo usan: en desarrollo,
    // Next compila cada ruta la primera vez y eso desestabiliza los tiempos.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-419',
  },

  projects: [
    {
      // El teléfono es el dispositivo principal durante una partida
      // (MASTER SPEC §3.6): se prueba primero ahí.
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  // Si se apunta a un servidor externo, Playwright no levanta el suyo.
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'node ./node_modules/next/dist/bin/next dev --webpack --port 3000',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 180_000,
        },
      }),
});
