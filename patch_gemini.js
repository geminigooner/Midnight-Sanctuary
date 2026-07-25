import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');
code = code.replace(
  /\.filter\(p => \{\n\s*if \(p\.text && p\.text\.trim\(\)\.length > 0\) return true;\n\s*if \(p\.inlineData \|\| p\.functionCall \|\| p\.functionResponse\) return true;\n\s*if \(isGemma && \(p\.thought \|\| p\.thoughtSignature\)\) return true;\n\s*return false;\n\s*\}\)\n\s*\.map\(p => \{\n\s*if \(!isGemma\) \{\n\s*const \{ thought, thoughtSignature, \.\.\.rest \} = p;\n\s*return rest;\n\s*\}\n\s*return p;\n\s*\}\)/,
  `.filter(p => {
          if (p.thought === true) return false;
          if (p.text && p.text.trim().length > 0) return true;
          if (p.inlineData || p.functionCall || p.functionResponse) return true;
          if (p.thoughtSignature) return true;
          return false;
        })
        .map(p => {
          const { thought, ...clean } = p;
          if (!isGemma) {
            const { thoughtSignature, ...rest } = clean;
            return rest;
          }
          return clean;
        })`
);
fs.writeFileSync('src/lib/gemini.ts', code);
