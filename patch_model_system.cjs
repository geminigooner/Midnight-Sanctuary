const fs = require('fs');
let code = fs.readFileSync('src/lib/modelSystem.ts', 'utf8');

const target = `const MODEL_REGISTRY: Record<string, ModelDefinition> = {};`;
const replacement = `const MODEL_REGISTRY: Record<string, ModelDefinition> = {
  'gemini-3-flash-preview': {
    identityId: 'gemini-3-flash-preview',
    apiModelId: 'models/gemini-3.0-flash', 
    displayName: 'Gemini 3 Flash Preview',
    namespace: 'gemini',
    capabilities: {
      supportsSystemInstructions: true,
      supportsToolCalling: true,
      supportsVision: true,
      supportsThinking: true,
      supportsStreaming: true
    }
  }
};`;

code = code.replace(target, replacement);

fs.writeFileSync('src/lib/modelSystem.ts', code);
console.log("Patched modelSystem.ts");
