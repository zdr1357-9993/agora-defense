import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

// 결과·트레이스는 로컬 디스크에 쓴다. (네트워크로 붙은 폴더에 쓰면 연결이 끊길 때 시험이 깨진다)
export const OUT = process.env.PW_OUT || path.join(os.tmpdir(), 'agora-e2e');

// E2E_BASE_URL 이 있으면 그 주소(예: stage 미리보기)를, 없으면 로컬 개발 서버를 시험한다.
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const executablePath = process.env.PW_CHROME || undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: 0,
  outputDir: path.join(OUT, 'test-results'),
  reporter: [['list'], ['json', { outputFile: path.join(OUT, 'e2e-results.json') }], ['junit', { outputFile: path.join(OUT, 'e2e-results.xml') }]],
  use: { baseURL, launchOptions: { executablePath, args: ['--no-sandbox'] }, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev:local', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 60_000,
  },
});
