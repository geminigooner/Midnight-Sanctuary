import fs from 'fs';
let code = fs.readFileSync('src/index.css', 'utf8');

const themeGemma = `
/* Gemma Theme Overrides */
.theme-gemma {
  --color-obsidian: #0B0E14;
  --color-plum: #1F2635;
  --color-ink: #0F121C;
  --color-chocolate: #161224;
  --color-mauve: #E0B1CB;
  --color-copper: #4E31AA;
  --color-champagne: #F5DDE7;
  --color-pearlescent: #EEEDF2;
  --color-glass: rgba(255, 255, 255, 0.04);
  --color-glass-border: rgba(78, 49, 170, 0.2);
}

.theme-gemma body {
  background-image: 
    radial-gradient(circle at 15% 50%, rgba(31, 38, 53, 0.6) 0%, transparent 50%),
    radial-gradient(circle at 85% 30%, rgba(78, 49, 170, 0.25) 0%, transparent 50%);
}
`;

if (!code.includes('.theme-gemma')) {
  code = code.replace("body {", themeGemma + "body {");
  fs.writeFileSync('src/index.css', code);
  console.log("Patched css");
} else {
  console.log("Already patched css");
}
