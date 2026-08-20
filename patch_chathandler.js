import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const catchTarget = `      } catch (err: any) {
        console.error('API Error:', err);
        console.error('API Error detail:', JSON.stringify({
          status: err?.status, code: err?.code, name: err?.name,
          message: err?.message, response: err?.response?.data ?? err?.error
        }, null, 2));
        try {`;

const fallbackCode = `      } catch (err: any) {
        console.error('API Error:', err);
        console.error('API Error detail:', JSON.stringify({
          status: err?.status, code: err?.code, name: err?.name,
          message: err?.message, response: err?.response?.data ?? err?.error
        }, null, 2));

        if (abortSignal?.aborted) {
          safeClose();
          return;
        }

        try {
          console.log("Attempting Cloudflare fallback...");
          const cfMessages = [];
          if (systemInstruction) {
            cfMessages.push({ role: 'system', content: systemInstruction });
          }
          for (const m of currentMessages) {
            const role = m.role === 'model' ? 'assistant' : 'user';
            const content = (m.parts || []).map((p: any) => p.text || '').join('');
            if (content) {
              cfMessages.push({ role, content });
            }
          }
          
          send(\`data: \${JSON.stringify({ type: 'backend', name: 'cloudflare' })}\\n\\n\`);
          
          const cfRes = await fetch(\`https://api.cloudflare.com/client/v4/accounts/\${process.env.CF_ACCOUNT_ID}/ai/run/@cf/google/gemma-4-26b-a4b-it\`, {
            method: 'POST',
            headers: {
              'Authorization': \`Bearer \${process.env.CF_API_TOKEN}\`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: cfMessages,
              stream: true,
              max_tokens: 4096
            }),
            signal: abortSignal
          });

          if (!cfRes.ok) {
            throw new Error(\`Cloudflare API Error: \${cfRes.status} \${cfRes.statusText}\`);
          }

          const reader = cfRes.body?.getReader();
          if (!reader) throw new Error("No response body from Cloudflare");
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') break;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.response) {
                    send(\`data: \${JSON.stringify({ type: 'text', text: parsed.response })}\\n\\n\`);
                  }
                } catch (e) {}
              }
            }
          }
          
          if (buffer.startsWith('data: ')) {
             const data = buffer.slice(6).trim();
             if (data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.response) {
                    send(\`data: \${JSON.stringify({ type: 'text', text: parsed.response })}\\n\\n\`);
                  }
                } catch (e) {}
             }
          }

          send('data: [DONE]\\n\\n');
          safeClose();
          return;
        } catch (cfErr: any) {
          console.error("Cloudflare fallback failed:", cfErr);
        }

        try {`;

code = code.replace(catchTarget, fallbackCode);

fs.writeFileSync('src/backend/chatHandler.ts', code);
