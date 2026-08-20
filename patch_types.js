import fs from 'fs';
let code = fs.readFileSync('src/lib/types.ts', 'utf8');

code = code.replace(
  "export interface UserProfile {\n  name: string;\n  pronouns?: string;\n  location?: string;\n  occupation?: string;\n  about?: string;\n  favorites?: string;\n  photo?: { mimeType: string; data: string };\n  gemmaNotes?: { text: string; timestamp: number }[];\n}",
  `export interface UserProfile {
  name: string;
  pronouns?: string;
  location?: string;
  occupation?: string;
  about?: string;
  currentVibe?: string;
  favorites?: string;
  askMeAbout?: string;
  pleaseKnow?: string;
  photo?: { mimeType: string; data: string };
  backgroundImage?: { mimeType: string; data: string };
  gemmaNotes?: { text: string; timestamp: number }[];
}`
);

fs.writeFileSync('src/lib/types.ts', code);
