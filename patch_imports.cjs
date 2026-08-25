const fs = require('fs');
let code = fs.readFileSync('src/lib/persistenceSystem.ts', 'utf8');

code = code.replace(
  "import { doc, setDoc, onSnapshot } from 'firebase/firestore';",
  "import { doc, setDoc, getDoc } from 'firebase/firestore';"
);

code = code.replace(
  "  import('firebase/firestore').then(({ getDoc }) => {",
  ""
);

code = code.replace(
  "  });\n\n  return () => {};",
  "\n  return () => {};"
);

fs.writeFileSync('src/lib/persistenceSystem.ts', code);
console.log('Fixed imports');
