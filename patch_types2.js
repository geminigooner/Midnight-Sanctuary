import fs from 'fs';
let code = fs.readFileSync('src/lib/types.ts', 'utf8');

code = code.replace(
  "export interface Memory {\n  id: string;\n  content: string;\n  createdAt: number;\n  origin?: string;\n}",
  `export interface Memory {
  id: string;
  content: string;
  createdAt: number;
  origin?: string;
  author?: 'user' | 'model';
  modelId?: string;
  caption?: string;
}`
);

fs.writeFileSync('src/lib/types.ts', code);
