import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
code = code.replace(
  "      if (!currentModelText && !currentModelThought && !hasToolCalls) {\n         updateModelMessage('[Gemma returned an empty response — check console/logs]', currentModelThought, 'complete');\n      } else {",
  "      if (!currentModelText && !currentModelThought) {\n         updateModelMessage('[No content in final round — see server logs]', '', 'error');\n         setTemporaryPresence('error', 'resting', 5000);\n      } else {"
);
fs.writeFileSync('src/components/ChatArea.tsx', code);
