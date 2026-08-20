import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Add currentModelBackend initialization
const searchInit = `    let currentModelApiParts: any[] = [];
    let currentModelFinishReason: string | undefined;
    let isFirstChunk = true;`;
const replaceInit = `    let currentModelApiParts: any[] = [];
    let currentModelFinishReason: string | undefined;
    let currentModelBackend: string | undefined;
    let isFirstChunk = true;`;
code = code.replace(searchInit, replaceInit);

// Add backend to updateModelMessage inside handleSend
const searchUpdateMessage = `        thoughtStatus: status,
        finishReason: currentModelFinishReason,
      });
    };`;
const replaceUpdateMessage = `        thoughtStatus: status,
        finishReason: currentModelFinishReason,
        backend: currentModelBackend,
      });
    };`;
code = code.replace(searchUpdateMessage, replaceUpdateMessage);

// Also add to the history_append branch
const searchHistoryUpdate = `              thoughtStatus: 'complete',
              finishReason: currentModelFinishReason,
            });`;
const replaceHistoryUpdate = `              thoughtStatus: 'complete',
              finishReason: currentModelFinishReason,
              backend: currentModelBackend,
            });`;
code = code.replace(searchHistoryUpdate, replaceHistoryUpdate);

// Add parsing for chunk.type === 'backend'
const searchChunkParsing = `          } else if (chunk.type === 'finish_reason') {
            currentModelFinishReason = chunk.reason;
            updateModelMessage(currentModelText, currentModelThought, 'complete');
          }
        }
      }`;
const replaceChunkParsing = `          } else if (chunk.type === 'finish_reason') {
            currentModelFinishReason = chunk.reason;
            updateModelMessage(currentModelText, currentModelThought, 'complete');
          } else if (chunk.type === 'backend') {
            currentModelBackend = chunk.name;
            updateModelMessage(currentModelText, currentModelThought, 'complete');
          }
        }
      }`;
code = code.replace(searchChunkParsing, replaceChunkParsing);

// Add rendering
const searchRender = `            {msg.finishReason && (
              <div className="text-xs text-mauve/50 mt-2 italic">
                [cut off: {msg.finishReason}]
              </div>
            )}`;
const replaceRender = `            {msg.finishReason && (
              <div className="text-xs text-mauve/50 mt-2 italic">
                [cut off: {msg.finishReason}]
              </div>
            )}
            
            {msg.backend === 'cloudflare' && (
              <div className="text-xs text-mauve/50 mt-2 italic">
                via Cloudflare
              </div>
            )}`;
code = code.replace(searchRender, replaceRender);

fs.writeFileSync('src/components/ChatArea.tsx', code);
