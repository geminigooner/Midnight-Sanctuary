import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const search = `      let rawTextAccumulator = '';
      let apiThoughtAccumulator = '';

      const updateWithParsedThinking = (textChunk) => {
         if (textChunk) rawTextAccumulator += textChunk;
         
         let parsedThought = apiThoughtAccumulator;
         let parsedText = rawTextAccumulator;
         let status = 'complete';

         const thinkStartIndex = rawTextAccumulator.indexOf('<think>');
         if (thinkStartIndex !== -1) {
           const thinkEndIndex = rawTextAccumulator.indexOf('</think>', thinkStartIndex);
           if (thinkEndIndex !== -1) {
             parsedThought = (apiThoughtAccumulator ? apiThoughtAccumulator + '\\n' : '') + rawTextAccumulator.substring(thinkStartIndex + 7, thinkEndIndex);
             parsedText = rawTextAccumulator.substring(0, thinkStartIndex) + rawTextAccumulator.substring(thinkEndIndex + 8);
             status = 'complete';
           } else {
             parsedThought = (apiThoughtAccumulator ? apiThoughtAccumulator + '\\n' : '') + rawTextAccumulator.substring(thinkStartIndex + 7);
             parsedText = rawTextAccumulator.substring(0, thinkStartIndex);
             status = 'thinking';
           }
         }
         
         currentModelText = parsedText.trimStart();
         currentModelThought = parsedThought.trimStart();
         updateModelMessage(currentModelText, currentModelThought, status);
      };`;

const replace = `      let rawTextAccumulator = '';
      let apiThoughtAccumulator = '';
      let lastUpdateTime = 0;
      let pendingUpdate = false;

      const updateWithParsedThinking = (textChunk, force = false) => {
         if (textChunk) rawTextAccumulator += textChunk;
         
         let parsedThought = apiThoughtAccumulator;
         let parsedText = rawTextAccumulator;
         let status = 'complete';

         const thinkStartIndex = rawTextAccumulator.indexOf('<think>');
         if (thinkStartIndex !== -1) {
           const thinkEndIndex = rawTextAccumulator.indexOf('</think>', thinkStartIndex);
           if (thinkEndIndex !== -1) {
             parsedThought = (apiThoughtAccumulator ? apiThoughtAccumulator + '\\n' : '') + rawTextAccumulator.substring(thinkStartIndex + 7, thinkEndIndex);
             parsedText = rawTextAccumulator.substring(0, thinkStartIndex) + rawTextAccumulator.substring(thinkEndIndex + 8);
             status = 'complete';
           } else {
             parsedThought = (apiThoughtAccumulator ? apiThoughtAccumulator + '\\n' : '') + rawTextAccumulator.substring(thinkStartIndex + 7);
             parsedText = rawTextAccumulator.substring(0, thinkStartIndex);
             status = 'thinking';
           }
         }
         
         currentModelText = parsedText.trimStart();
         currentModelThought = parsedThought.trimStart();
         
         const now = Date.now();
         if (force || now - lastUpdateTime > 50) {
           updateModelMessage(currentModelText, currentModelThought, status);
           lastUpdateTime = now;
           pendingUpdate = false;
         } else {
           pendingUpdate = true;
         }
      };`;

code = code.replace(search, replace);

// Now patch the loop termination to flush pending updates
const loopSearch = `        } else if (chunk && typeof chunk === 'object') {
          if (chunk.type === 'thought') {
            apiThoughtAccumulator += chunk.text;
            updateWithParsedThinking('');
            updateModelMessage(currentModelText, currentModelThought, 'thinking');`;

const loopReplace = `        } else if (chunk && typeof chunk === 'object') {
          if (chunk.type === 'thought') {
            apiThoughtAccumulator += chunk.text;
            updateWithParsedThinking('', true);
            updateModelMessage(currentModelText, currentModelThought, 'thinking');`;

code = code.replace(loopSearch, loopReplace);

const endSearch = `      }
      
      if (!hasToolCalls) {
        if (!currentModelText && !currentModelThought) {`;

const endReplace = `      }
      
      if (pendingUpdate) {
        updateWithParsedThinking('', true);
      }
      
      if (!hasToolCalls) {
        if (!currentModelText && !currentModelThought) {`;

code = code.replace(endSearch, endReplace);
fs.writeFileSync('src/components/ChatArea.tsx', code);
