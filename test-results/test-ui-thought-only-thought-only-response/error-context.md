# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test-ui-thought-only.spec.ts >> thought only response
- Location: test-ui-thought-only.spec.ts:2:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.prose-invert').last()
Expected substring: "This is a thought."
Received string:    "Thought process"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('.prose-invert').last()
    14 × locator resolved to <div class="prose prose-invert prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-glass-border prose-pre:overflow-x-auto min-w-0 max-w-none break-words [overflow-wrap:anywhere] ">…</div>
       - unexpected value "Thought process"

```

```yaml
- button "Thought process"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | test('thought only response', async ({ page }) => {
  3  |   await page.goto('http://localhost:3000');
  4  |   
  5  |   // Click new conversation if empty state
  6  |   const isTextareaVisible = await page.locator('textarea[placeholder="Whisper to the void..."]').isVisible();
  7  |   if (!isTextareaVisible) {
  8  |      await page.getByRole('button', { name: /New Sanctuary/i }).click(); 
  9  |      await page.waitForTimeout(1000);
  10 |   }
  11 | 
  12 |   // Set model to gemini-2.5-flash
  13 |   await page.evaluate(() => {
  14 |     window.localStorage.setItem('settings', JSON.stringify({ model: 'models/gemini-2.5-flash' }));
  15 |   });
  16 | 
  17 |   // Mock the backend
  18 |   await page.route(/\/api\/chat/, async route => {
  19 |     await route.fulfill({
  20 |       status: 200,
  21 |       contentType: 'text/event-stream',
  22 |       body: 'data: {"type":"thought", "text":"This is a thought."}\n\ndata: {"type":"thought", "text":" This is more thought."}\n\ndata: [DONE]\n\n'
  23 |     });
  24 |   });
  25 | 
  26 |   const textarea = page.locator('textarea[placeholder="Whisper to the void..."]');
  27 |   await textarea.fill('test thought only');
  28 |   await page.keyboard.press('Enter');
  29 |   
  30 |   await page.waitForTimeout(3000);
  31 |   
  32 |   const allText = await page.locator('body').textContent();
  33 |   console.log("ALL TEXT:", allText);
> 34 |   await expect(page.locator('.prose-invert').last()).toContainText('This is a thought.');
     |                                                      ^ Error: expect(locator).toContainText(expected) failed
  35 | });
  36 | 
```