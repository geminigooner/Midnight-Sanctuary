import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    <div className="flex h-[100dvh] overflow-hidden bg-obsidian text-pearlescent relative w-full">`;
const isGemmaTheme = `  const themeClass = store.settings.model.includes('gemma') ? 'theme-gemma' : '';`;
const replacement = `    <div className={\`flex h-[100dvh] overflow-hidden bg-obsidian text-pearlescent relative w-full \${themeClass}\`}>`;

if (!code.includes('themeClass')) {
  code = code.replace("  return (", isGemmaTheme + "\n  return (");
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched App.tsx");
} else {
  console.log("Already patched App.tsx");
}
