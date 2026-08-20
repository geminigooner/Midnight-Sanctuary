import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
const search = "inlineData: giftFile ? { mimeType: giftFile.mimeType, data: giftFile.data, previewUrl: giftFile.previewUrl } : undefined";
const replace = "inlineData: giftFile ? { mimeType: giftFile.mimeType, data: giftFile.data } : undefined";
code = code.replace(search, replace);
fs.writeFileSync('src/components/ChatArea.tsx', code);
