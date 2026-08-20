import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

code = code.replace('const profileLines: string[] = ["MY PROFILE"];', 'const profileLines: string[] = ["USER PROFILE"];');
code = code.replace("let profileSection = `## About the person you're talking with\\n${profileLines.join('\\n')}`;", "let profileSection = `## User Profile Context\\n${profileLines.join('\\n')}`;");

fs.writeFileSync('src/lib/gemini.ts', code);
