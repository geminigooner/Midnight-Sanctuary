const fs = require('fs');
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const target = `    model: settings.model,
    forceCloudflare: settings.forceCloudflare
  };`;

const replacement = `    model: settings.model,
    forceCloudflare: settings.forceCloudflare,
    thinkingLevel: settings.thinkingLevel,
    includeThoughts: settings.includeThoughts
  };`;

code = code.replace(target, replacement);

fs.writeFileSync('src/lib/gemini.ts', code);
console.log("Patched gemini.ts");
