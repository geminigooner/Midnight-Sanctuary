import { test, expect } from '@playwright/test';
test('screenshot', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot.png' });
});
