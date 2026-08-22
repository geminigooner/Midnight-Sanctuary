import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const oldHeader = `<div className="bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-full px-4 py-1.5 w-full flex justify-between items-center shadow-[inset_0_-2px_0_rgba(0,0,0,0.05)] text-sm">
                   <span className="text-[#2C194D] font-bold truncate">
                     ✨ {(Array.isArray(availableModels) ? availableModels : [])?.find(m => m.name === settings.model)?.displayName || settings.model?.split('/').pop() || 'Unknown Model'}
                   </span>
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2C194D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>`;

const newHeader = `<div className="relative bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-full px-4 py-1.5 w-full flex justify-between items-center shadow-[inset_0_-2px_0_rgba(0,0,0,0.05)] text-sm overflow-hidden">
                   <select 
                     value={settings.model} 
                     onChange={(e) => onUpdateSettings({ model: e.target.value })}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                   >
                     {(Array.isArray(availableModels) ? availableModels : []).map(m => (
                       <option key={m.name} value={m.name}>{m.displayName}</option>
                     ))}
                   </select>
                   <span className="text-[#2C194D] font-bold truncate pointer-events-none">
                     ✨ {(Array.isArray(availableModels) ? availableModels : [])?.find(m => m.name === settings.model)?.displayName || settings.model?.split('/').pop() || 'Unknown Model'}
                   </span>
                   <svg className="pointer-events-none shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2C194D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>`;

code = code.replace(oldHeader, newHeader);
fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched ChatArea model selector");
