import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const search = `            currentModelText = '';
            currentModelThought = '';
            currentModelApiParts = [];
            isFirstChunk = true;`;

const replace = `            currentModelText = '';
            currentModelThought = '';
            currentModelApiParts = [];
            rawTextAccumulator = '';
            apiThoughtAccumulator = '';
            isFirstChunk = true;`;

code = code.replace(search, replace);
fs.writeFileSync('src/components/ChatArea.tsx', code);
