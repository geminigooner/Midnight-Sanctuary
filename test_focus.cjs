const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.error('Page error:', err);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('Console error:', msg.text());
  });
  
  await page.goto('http://localhost:3000');
  await page.waitForSelector('textarea[placeholder="Whisper to the void..."]', { timeout: 5000 });
  
  console.log("Focusing textarea...");
  await page.focus('textarea[placeholder="Whisper to the void..."]');
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
