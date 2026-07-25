import { test, expect } from '@playwright/test';
test('console', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);
  await page.getByText('New Sanctuary').click();
  await page.waitForTimeout(2000);
});
