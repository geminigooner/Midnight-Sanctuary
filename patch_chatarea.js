import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Replace the stream chunk processing:
const oldLoop = `      for await (const chunk of generator) {
        resetIdleTimeout();
        if (typeof chunk === 'string') {
          // Fallback if somehow a string leaks through
          if (isFirstChunk) {
            setPresence('responding');
            isFirstChunk = false;
          }
          currentModelText += chunk;
          updateModelMessage(currentModelText, currentModelThought, 'complete');
        } else if (chunk && typeof chunk === 'object') {
          if (chunk.type === 'thought') {
            currentModelThought += chunk.text;
            updateModelMessage(currentModelText, currentModelThought, 'thinking');
          } else if (chunk.type === 'text') {
            if (isFirstChunk) {
              setPresence('responding');
              isFirstChunk = false;
            }
            currentModelText += chunk.text;
            updateModelMessage(currentModelText, currentModelThought, 'complete');
          } else if (chunk.type === 'gift') {`;

const newLoop = `      let rawTextAccumulator = '';
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
      };

      for await (const chunk of generator) {
        resetIdleTimeout();
        if (typeof chunk === 'string') {
          if (isFirstChunk) { setPresence('responding'); isFirstChunk = false; }
          updateWithParsedThinking(chunk);
        } else if (chunk && typeof chunk === 'object') {
          if (chunk.type === 'thought') {
            apiThoughtAccumulator += chunk.text;
            updateWithParsedThinking('');
            updateModelMessage(currentModelText, currentModelThought, 'thinking');
          } else if (chunk.type === 'text') {
            if (isFirstChunk) { setPresence('responding'); isFirstChunk = false; }
            updateWithParsedThinking(chunk.text);
          } else if (chunk.type === 'gift') {`;

code = code.replace(oldLoop, newLoop);
fs.writeFileSync('src/components/ChatArea.tsx', code);
