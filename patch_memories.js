import fs from 'fs';
let code = fs.readFileSync('src/components/MemoriesArchive.tsx', 'utf8');
code = code.replace(
  "import React from 'react';",
  "import React, { useState, useEffect, useRef } from 'react';"
);

code = code.replace(
  "export function MemoriesArchive({ memories, onClose, onRemoveMemory }: MemoriesArchiveProps) {",
  `export function MemoriesArchive({ memories, onClose, onRemoveMemory }: MemoriesArchiveProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      setConfirmDeleteId(null);
    };
    if (confirmDeleteId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [confirmDeleteId]);`
);

code = code.replace(
  `                <div key={memory.id} className="bg-glass border border-glass-border rounded-xl p-5 hover:border-copper/40 transition-colors flex flex-col gap-3 group relative">
                  <div className="flex-1 text-pearlescent prose prose-invert prose-p:leading-relaxed prose-sm max-w-none">`,
  `                <div key={memory.id} className="bg-glass border border-glass-border rounded-xl p-5 hover:border-copper/40 transition-colors flex flex-col gap-3 group relative">
                  
                  {onRemoveMemory && (
                    <div className="absolute top-2 right-2">
                      {confirmDeleteId === memory.id ? (
                        <button
                          onMouseDown={(e) => { e.stopPropagation(); onRemoveMemory(memory.id); setConfirmDeleteId(null); }}
                          className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 bg-red-400/10 rounded"
                        >
                          delete?
                        </button>
                      ) : (
                        <button
                          onMouseDown={(e) => { e.stopPropagation(); setConfirmDeleteId(memory.id); }}
                          className="p-1 text-mauve hover:text-red-400 transition-colors rounded-full hover:bg-white/5 opacity-0 group-hover:opacity-100"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex-1 text-pearlescent prose prose-invert prose-p:leading-relaxed prose-sm max-w-none pt-2">`
);

code = code.replace(
  `                    {onRemoveMemory && (
                      <button 
                        onClick={() => onRemoveMemory(memory.id)}
                        className="text-mauve hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Remove Memory"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}`,
  ""
);

code = code.replace(
  `                      <span className="text-xs text-copper/80 uppercase tracking-widest font-medium">
                        {memory.origin === 'gemma_initiated' ? 'From Gemma' : 'Recorded'}
                      </span>`,
  `                      <span className="text-xs text-copper/80 uppercase tracking-widest font-medium">
                        {memory.author === 'model' ? (memory.modelId || 'From Model') : (memory.origin === 'gemma_initiated' ? 'From Gemma' : 'Recorded')}
                      </span>`
);

fs.writeFileSync('src/components/MemoriesArchive.tsx', code);
