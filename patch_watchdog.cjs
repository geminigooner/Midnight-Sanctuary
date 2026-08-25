const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// 1. Update resetIdleTimeout
const oldTimeout = `    const resetIdleTimeout = () => {
      if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
      watchdogTimeoutRef.current = setTimeout(() => {
        console.warn("Idle timeout triggered. Aborting stuck stream.");
        if (abortControllerRef.current) abortControllerRef.current.abort();
      }, 90000); // 90 seconds idle timeout
    };`;

const newTimeout = `    const resetIdleTimeout = () => {
      if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
      const isGemini3 = settings.model.includes('gemini-3');
      const timeoutMs = isGemini3 ? 240000 : 90000;
      watchdogTimeoutRef.current = setTimeout(() => {
        console.warn("Idle timeout triggered. Aborting stuck stream.");
        if (abortControllerRef.current) abortControllerRef.current.abort();
      }, timeoutMs); 
    };`;
code = code.replace(oldTimeout, newTimeout);

// 2. Update error message
const oldErrMsg = `         if (!currentModelText && !currentModelThought) {
            updateModelMessage('[Request timed out after 90 seconds — please try again]', currentModelThought, 'error');
            setTemporaryPresence('error', 'resting', 5000);
         } else {`;

const newErrMsg = `         if (!currentModelText && !currentModelThought) {
            const isGemini3 = settings.model.includes('gemini-3');
            updateModelMessage(\`[Request timed out after \${isGemini3 ? 240 : 90} seconds — please try again]\`, currentModelThought, 'error');
            setTemporaryPresence('error', 'resting', 5000);
         } else {`;
code = code.replace(oldErrMsg, newErrMsg);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched ChatArea.tsx");
