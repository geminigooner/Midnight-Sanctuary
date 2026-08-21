import fs from 'fs';
let code = fs.readFileSync('src/components/MemoriesArchive.tsx', 'utf8');

code = code.replace(/document\.addEventListener\('mousedown', handleClickOutside\)/g, "document.addEventListener('click', handleClickOutside)");
code = code.replace(/document\.removeEventListener\('mousedown', handleClickOutside\)/g, "document.removeEventListener('click', handleClickOutside)");

// Fix first button
const target1 = `                        <button
                          onMouseDown={(e) => { e.stopPropagation(); onRemoveMemory(memory.id); setConfirmDeleteId(null); }}
                          className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 bg-red-400/10 rounded"
                        >
                          delete?
                        </button>`;
const replacement1 = `                        <button
                          onClick={(e) => { e.stopPropagation(); onRemoveMemory(memory.id); setConfirmDeleteId(null); }}
                          className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 bg-red-400/10 rounded"
                        >
                          Confirm Delete
                        </button>`;
code = code.replace(target1, replacement1);

// Fix second button
const target2 = `                        <button
                          onMouseDown={(e) => { e.stopPropagation(); setConfirmDeleteId(memory.id); }}
                          className="p-1 text-mauve hover:text-red-400 transition-colors rounded-full hover:bg-white/5 opacity-0 group-hover:opacity-100"
                        >
                          <X size={14} />
                        </button>`;
const replacement2 = `                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(memory.id); }}
                          className="p-1.5 text-mauve/40 hover:text-red-400 transition-colors rounded-full hover:bg-white/5 opacity-100"
                          title="Delete memory"
                        >
                          <Trash2 size={15} />
                        </button>`;
code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/MemoriesArchive.tsx', code);
