import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const oldFetch = `      .then(res => {
        if (res.status === 401) {
          signOut(auth);
          throw new Error("Unauthorized");
        }
        return res.json();
      })
      .then((data: ModelInfo[]) => {
        setAvailableModels(data);
        setIsModelsLoading(false);
      })`;

const newFetch = `      .then(async res => {
        if (res.status === 401) {
          signOut(auth);
          throw new Error("Unauthorized");
        }
        const text = await res.text();
        if (text.includes('<!DOCTYPE html>')) {
          console.error('Server returned HTML instead of JSON for models');
          return [];
        }
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse models JSON');
          return [];
        }
      })
      .then((data: ModelInfo[]) => {
        setAvailableModels(Array.isArray(data) ? data : []);
        setIsModelsLoading(false);
      })`;

code = code.replace(oldFetch, newFetch);

fs.writeFileSync('src/lib/store.ts', code);
