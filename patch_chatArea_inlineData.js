import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target = `                    parts: [{
                       functionResponse: {
                          name: chunk.name,
                          id: chunk.callId,
                          response: {
                             result: "image attached",
                             image: { mimeType: 'image/jpeg', data: base64Data }
                          }
                       }
                    }],`;

const replacement = `                    parts: [
                       {
                          functionResponse: {
                             name: chunk.name,
                             id: chunk.callId,
                             response: {
                                result: "The profile image is attached to this message."
                             }
                          }
                       },
                       {
                          inlineData: { mimeType: 'image/jpeg', data: base64Data }
                       }
                    ],`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/ChatArea.tsx', code);
