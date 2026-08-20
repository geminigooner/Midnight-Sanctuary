import fs from 'fs';
let code = fs.readFileSync('src/components/MemoriesArchive.tsx', 'utf8');

const target = `                  <div className="flex-1 text-pearlescent prose prose-invert prose-p:leading-relaxed prose-sm max-w-none pt-2">
                    {memory.content}
                  </div>`;

const replacement = `                  <div className="flex-1 text-pearlescent prose prose-invert prose-p:leading-relaxed prose-sm max-w-none pt-2">
                    {memory.caption && (
                      <div className="text-xs text-copper/90 font-medium mb-2 opacity-80 uppercase tracking-wide">
                        {memory.caption}
                      </div>
                    )}
                    {memory.content}
                  </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/MemoriesArchive.tsx', code);
