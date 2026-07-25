import { test, expect } from '@playwright/test';
test('innertext', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  const text = await page.evaluate(() => document.body.innerText);
  console.log('PAGE TEXT:', text);
  
  const innerHTML = await page.evaluate(() => document.body.innerHTML);
  if(text.includes('Application Error')){
    console.log('ERROR HTML:', innerHTML);
  }
});
