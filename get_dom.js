import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  const body = await page.evaluate(() => document.body.innerText);
  console.log("BODY START\n", body.substring(0, 1000), "\nBODY END");
  await browser.close();
})();
