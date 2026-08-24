import fs from 'fs';

let content = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const startIndex = content.indexOf('const MessageBubble = React.memo(function MessageBubble(');
const endIndexStr = 'prev.isGenerating === next.isGenerating);';
let endIndex = content.indexOf(endIndexStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    endIndex += endIndexStr.length;
    
    let before = content.substring(0, startIndex);
    let after = content.substring(endIndex);
    
    // insert import right after other imports
    const importStr = "import { MessageBubble } from './MessageBubble';\n";
    
    // Find the last import
    const lastImportIndex = before.lastIndexOf('import ');
    const endOfLastImport = before.indexOf('\n', lastImportIndex) + 1;
    
    before = before.substring(0, endOfLastImport) + importStr + before.substring(endOfLastImport);
    
    fs.writeFileSync('src/components/ChatArea.tsx', before + after);
    console.log("Successfully extracted MessageBubble from ChatArea.tsx");
} else {
    console.error("Could not find MessageBubble boundaries");
    console.log(startIndex, endIndex);
}
