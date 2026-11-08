import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  fullyParallel: true,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.mjs',
  use: { baseURL: 'http://127.0.0.1:8799/', trace: 'off' },
  webServer: { command: 'node tests/e2e/serve-fixture.mjs', url: 'http://127.0.0.1:8799/', reuseExistingServer: false, timeout: 20000 },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 15 Pro'] } },
    { name: 'iphone-landscape-webkit', use: { ...devices['iPhone 15 Pro landscape'] } },
    { name: 'ipad-mini-webkit', use: { ...devices['iPad Mini'] } },
    { name: 'ipad-pro-landscape-webkit', use: { ...devices['iPad Pro 11 landscape'], viewport: { width: 1366, height: 1024 } } },
    { name: 'split-view-webkit', use: { ...devices['iPad Pro 11'], viewport: { width: 678, height: 1024 } } },
    { name: 'iphone-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
