import fs from 'fs';

function patchFile(filename, search, replace) {
  let code = fs.readFileSync(filename, 'utf8');
  code = code.replace(search, replace);
  fs.writeFileSync(filename, code);
}

patchFile(
  'src/backend/chatHandler.ts',
  `if (part.thought === true && part.text) {`,
  `if (part.thought === true && part.text) {`
); // Let's check exactly where it might be leaking into text.

