import { defineConfig, devices } from '@playwright/test';

// Pruebas de humo del front contra la compilación de producción (ver e2e/humo.spec.ts).
// Requiere haber compilado antes: ng build --configuration production
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4310', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'node e2e/servir-dist.mjs 4310', url: 'http://localhost:4310', reuseExistingServer: true, timeout: 30_000 }
});
