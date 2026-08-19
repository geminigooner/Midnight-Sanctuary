import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'setAuthError("This domain isn\'t authorized in Firebase yet. I\'ll need you to add it to the allowlist.");',
  'setAuthError(`Domain error: You need to add exactly this to the Firebase Authorized Domains list: ${window.location.hostname}`);'
);

fs.writeFileSync('src/App.tsx', code);
