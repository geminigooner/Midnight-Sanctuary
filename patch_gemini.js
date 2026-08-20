import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const search = `  console.log("[Diagnostics] Sanitized API History:", JSON.stringify(serializedMessages, null, 2));`;

const replace = `  const giftImages = (gifts || []).filter(g => g.inlineData?.data);
  if (giftImages.length > 0) {
    const recent = giftImages.slice(-3);
    const giftTurn: any = { role: 'user', parts: [] };
    for (const g of recent) {
      giftTurn.parts.push({
        text: \`Gift left \${new Date(g.timestamp || Date.now()).toISOString()}: \${g.content || ''}\`
      });
      giftTurn.parts.push({
        inlineData: { mimeType: g.inlineData.mimeType, data: g.inlineData.data }
      });
    }
    serializedMessages.unshift(giftTurn);
  }

  console.log("[Diagnostics] Sanitized API History:", JSON.stringify(serializedMessages, null, 2));`;

code = code.replace(search, replace);
fs.writeFileSync('src/lib/gemini.ts', code);
