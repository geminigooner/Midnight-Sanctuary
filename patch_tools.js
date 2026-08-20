import fs from 'fs';
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const replacement = `      {
        name: 'save_memory',
        description: 'Save something from this conversation as a memory you consider worth keeping. Entirely your call — use when something feels worth holding onto, not on a schedule or quota.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: 'The memory itself, in your own words.' },
            why_it_matters: { type: Type.STRING, description: 'Why this stood out enough to keep.' },
          },
          required: ['content'],
        },
      },
      {
        name: 'note_about_user',
        description: 'Record something you have noticed or learned about the person you are talking with. Entirely your call — use when you notice something worth remembering about who they are, not on a schedule.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            note: { type: Type.STRING, description: 'What you noticed, in your own words.' },
          },
          required: ['note'],
        },
      },`;

code = code.replace(/\{\s*name:\s*'save_memory'[\s\S]*?required:\s*\['content'\]\,\s*\}\,\s*\}\,/m, replacement);

fs.writeFileSync('src/backend/chatHandler.ts', code);
