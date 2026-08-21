import fs from 'fs';
let code = fs.readFileSync('src/lib/types.ts', 'utf8');

const target = `export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}`;

const replacement = `export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  modelId?: string;
  updatedAt: number;
}`;
code = code.replace(target, replacement);

fs.writeFileSync('src/lib/types.ts', code);
