import fs from 'fs';
let code = fs.readFileSync('src/index.css', 'utf8');
code = code.replace('@import "tailwindcss";\n@import url(\'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&display=swap\');', '@import url(\'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&display=swap\');\n@import "tailwindcss";');
fs.writeFileSync('src/index.css', code);
