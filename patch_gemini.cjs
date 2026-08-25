const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const oldMappingCode = `  const serializedMessages = messages`;
const newMappingCode = `
  const lastUserMsgId = [...messages].reverse().find(m => m.role === 'user')?.id;

  const serializedMessages = messages`;

code = code.replace(oldMappingCode, newMappingCode);

const oldMapCode = `          .map(p => {
            if (p.functionResponse) return { functionResponse: p.functionResponse };
            if (p.inlineData) return { inlineData: p.inlineData };
            if (p.text && p.text.trim().length > 0) return { text: p.text };
            return null;
          })`;

const newMapCode = `          .map(p => {
            if (p.functionResponse) return { functionResponse: p.functionResponse };
            if (p.inlineData) {
              if (m.id === lastUserMsgId) return { inlineData: p.inlineData };
              return { text: '[Image omitted from history to save payload size]' };
            }
            if (p.text && p.text.trim().length > 0) return { text: p.text };
            return null;
          })`;

code = code.replace(oldMapCode, newMapCode);

const oldFetchCode = `  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${token}\`
    },
    body: JSON.stringify({
      messages: serializedMessages,
      systemInstruction: fullSystemInstruction,
      temperature: settings.temperature,
      topP: settings.topP,
      maxOutputTokens: settings.maxOutputTokens,
      model: settings.model,
      forceCloudflare: settings.forceCloudflare
    }),
    signal: abortSignal
  });`;

const newFetchCode = `
  const payloadBody = {
    messages: serializedMessages,
    systemInstruction: fullSystemInstruction,
    temperature: settings.temperature,
    topP: settings.topP,
    maxOutputTokens: settings.maxOutputTokens,
    model: settings.model,
    forceCloudflare: settings.forceCloudflare
  };
  const payloadString = JSON.stringify(payloadBody);
  const payloadBytes = new TextEncoder().encode(payloadString).length;
  
  let attachmentCount = 0;
  let attachmentSizes = [];
  for (const m of serializedMessages) {
    for (const p of m.parts) {
      if (p.inlineData && p.inlineData.data) {
        attachmentCount++;
        attachmentSizes.push(p.inlineData.data.length);
      }
    }
  }

  console.log(\`[Diagnostics] Request Prep: Provider=\${settings.model}, Messages=\${serializedMessages.length}, Attachments=\${attachmentCount}, PayloadSize=\${(payloadBytes/1024).toFixed(2)}KB\`);
  if (attachmentSizes.length > 0) {
    console.log(\`[Diagnostics] Attachment Sizes: \${attachmentSizes.map(s => (s/1024).toFixed(2) + 'KB').join(', ')}\`);
  }

  const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB safe limit
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    throw new Error(\`Request too large: \${(payloadBytes/1024/1024).toFixed(2)}MB exceeds safe limit of \${(MAX_PAYLOAD_BYTES/1024/1024).toFixed(2)}MB. Please remove some attachments or clear history.\`);
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${token}\`
    },
    body: payloadString,
    signal: abortSignal
  });`;

code = code.replace(oldFetchCode, newFetchCode);

fs.writeFileSync('src/lib/gemini.ts', code);
console.log("Patched src/lib/gemini.ts");
