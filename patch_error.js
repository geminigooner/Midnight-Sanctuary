import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

// If the API throws a 403, and the response is HTML, it's likely Cloudflare blocking it.
// Wait, the error is an HTML block showing "netlify/ai/v1beta/models..."
// Let's parse that error gracefully so it doesn't break the UI.

code = code.replace(
  'throw new Error(err.error || `API Error: ${response.status}`);',
  `const errText = await response.text().catch(() => "");
    if (errText.includes("<!DOCTYPE html>")) {
      throw new Error(\`Network Error: The request was blocked by the host (Status \${response.status})\`);
    }
    let errObj = {};
    try { errObj = JSON.parse(errText); } catch(e) {}
    throw new Error(errObj.error || \`API Error: \${response.status}\`);`
);

fs.writeFileSync('src/lib/gemini.ts', code);
