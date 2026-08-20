import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

code = code.replace(
  "'[No content in final round — see server logs]'",
  "'[The model returned an empty response. It may have hit a silent safety filter or an API quirk.]'"
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
