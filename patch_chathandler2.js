import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const searchTools = `      {
        name: 'save_memory',
        description: 'Save something from this conversation as a memory you consider worth keeping. Entirely your call — use when something feels worth holding onto, not on a schedule or quota.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: 'The exact wording, thought, or realization you want to save.' },
            why_it_matters: { type: Type.STRING, description: 'Brief internal note on why you are saving this.' },
          },
          required: ['content'],
        },
      },
      {
        name: 'log_event',`;
const replaceTools = `      {
        name: 'save_memory',
        description: 'Save something from this conversation as a memory you consider worth keeping. Entirely your call — use when something feels worth holding onto, not on a schedule or quota.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: 'The exact wording, thought, or realization you want to save.' },
            why_it_matters: { type: Type.STRING, description: 'Brief internal note on why you are saving this.' },
          },
          required: ['content'],
        },
      },
      {
        name: 'note_about_user',
        description: 'Record something you\\'ve noticed or learned about the person you\\'re talking with.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            note: { type: Type.STRING, description: 'The note about the user.' },
          },
          required: ['note'],
        },
      },
      {
        name: 'log_event',`;

code = code.replace(searchTools, replaceTools);

const searchFuncHandle = `                  } else if (call.name === 'save_memory') {
                    send(\`data: \${JSON.stringify({ type: 'memory', ...call.args })}\\n\\n\`);
                  } else if (call.name === 'log_event') {`;
const replaceFuncHandle = `                  } else if (call.name === 'save_memory') {
                    send(\`data: \${JSON.stringify({ type: 'memory', ...call.args })}\\n\\n\`);
                  } else if (call.name === 'note_about_user') {
                    send(\`data: \${JSON.stringify({ type: 'user_note', ...call.args })}\\n\\n\`);
                  } else if (call.name === 'log_event') {`;

code = code.replace(searchFuncHandle, replaceFuncHandle);

fs.writeFileSync('src/backend/chatHandler.ts', code);
