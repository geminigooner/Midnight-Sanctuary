import fs from 'fs';

let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Import StreamingMarkdown
if (!code.includes('StreamingMarkdown')) {
  code = code.replace("import Markdown from 'react-markdown';", "import Markdown from 'react-markdown';\nimport { StreamingMarkdown } from './StreamingMarkdown';");
}

// Replace <Markdown>{publicText}</Markdown> with <StreamingMarkdown content={publicText} isGenerating={isGenerating && isLast} />
code = code.replace(
  "<Markdown>{publicText}</Markdown>",
  "<StreamingMarkdown content={publicText} isGenerating={isGenerating && isLast} />"
);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched successfully");
