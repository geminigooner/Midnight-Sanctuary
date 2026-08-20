import fs from 'fs';
let code = fs.readFileSync('src/components/GiftsArchive.tsx', 'utf8');

code = code.replace(
  /onClick=\{\(\) => setSelectedImage\(gift\.inlineData!\.previewUrl \|\| `data:\$\{gift\.inlineData!\.mimeType\};base64,\$\{gift\.inlineData!\.data\}`\)\}/g,
  "onClick={() => setSelectedImage(`data:${gift.inlineData!.mimeType};base64,${gift.inlineData!.data}`)}"
);

code = code.replace(
  /<img src=\{gift\.inlineData\.previewUrl \|\| `data:\$\{gift\.inlineData\.mimeType\};base64,\$\{gift\.inlineData\.data\}`\} className="w-full h-full object-cover" alt="gift" \/>/g,
  '<img src={`data:${gift.inlineData.mimeType};base64,${gift.inlineData.data}`} className="w-full h-full object-cover" alt="gift" />'
);

fs.writeFileSync('src/components/GiftsArchive.tsx', code);
