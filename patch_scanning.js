import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const targetImport = `import { Send, Settings as SettingsIcon, Menu, StopCircle, RefreshCw, Copy, Download, Edit3, Paperclip, Terminal, Gift, X, MoreVertical, User, Bookmark, Smile } from 'lucide-react';`
const replacementImport = `import { Send, Settings as SettingsIcon, Menu, StopCircle, RefreshCw, Copy, Download, Edit3, Paperclip, Terminal, Gift, X, MoreVertical, User, Bookmark, Smile, Scan } from 'lucide-react';`
code = code.replace(targetImport, replacementImport);

const targetState = `  const [input, setInput] = useState('');`
const replacementState = `  const [isScanningProfile, setIsScanningProfile] = useState(false);
  const [input, setInput] = useState('');`
code = code.replace(targetState, replacementState);

const targetToolCall = `                 const functionResponseMsg = {
                    id: Math.random().toString(36).substring(2, 9),
                    role: 'user',
                    parts: [
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
                    ],
                    timestamp: Date.now()
                 };
                 handleSend('', undefined, [functionResponseMsg as any]);
               } catch (e) {
                 console.error("Failed to capture profile view", e);
               }
            } else {`

const replacementToolCall = `                 const functionResponseMsg = {
                    id: Math.random().toString(36).substring(2, 9),
                    role: 'user',
                    parts: [
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
                    ],
                    timestamp: Date.now()
                 };
                 setIsScanningProfile(true);
                 setTimeout(() => {
                   setIsScanningProfile(false);
                   handleSend('', undefined, [functionResponseMsg as any]);
                 }, 1500);
               } catch (e) {
                 console.error("Failed to capture profile view", e);
               }
            } else {`
code = code.replace(targetToolCall, replacementToolCall);

const targetJSX = `  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-plum/10 via-obsidian/0 to-obsidian/0"></div>`

const replacementJSX = `  return (
    <div className="flex-1 flex flex-col h-full bg-obsidian relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-plum/10 via-obsidian/0 to-obsidian/0"></div>
      <AnimatePresence>
        {isScanningProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-[100] overflow-hidden"
          >
             <div className="absolute inset-0 bg-copper/5 mix-blend-screen" />
             <motion.div 
               initial={{ top: '-10%' }}
               animate={{ top: '110%' }}
               transition={{ duration: 1.5, ease: "linear" }}
               className="absolute left-0 right-0 h-1 bg-copper shadow-[0_0_15px_rgba(196,118,83,0.8)]"
             />
             <div className="absolute top-4 right-4 bg-ink/90 backdrop-blur-md border border-copper/30 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-xl">
                <Scan size={14} className="text-copper animate-pulse" />
                <span className="text-xs text-copper tracking-widest uppercase">Model is inspecting your profile...</span>
             </div>
          </motion.div>
        )}
      </AnimatePresence>`
code = code.replace(targetJSX, replacementJSX);

fs.writeFileSync('src/components/ChatArea.tsx', code);
