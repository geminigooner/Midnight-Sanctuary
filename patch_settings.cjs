const fs = require('fs');
let code = fs.readFileSync('src/components/Settings.tsx', 'utf8');

const target = `                        <input 
                          type="range" min="1" max="8192" step="1" 
                          value={settings.maxOutputTokens}
                          onChange={e => onSave({ maxOutputTokens: parseInt(e.target.value) })}
                          className="w-full accent-[#F198B7]"
                        />
                      </div>`;

const replacement = `                        <input 
                          type="range" min="1" max="8192" step="1" 
                          value={settings.maxOutputTokens}
                          onChange={e => onSave({ maxOutputTokens: parseInt(e.target.value) })}
                          className="w-full accent-[#F198B7]"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <label className="text-sm text-[#F5E1C8] font-bold">Thinking Level</label>
                        <select
                          value={settings.thinkingLevel || 'HIGH'}
                          onChange={e => onSave({ thinkingLevel: e.target.value as any })}
                          className="w-full bg-[#151234] text-[#F5E1C8] border-2 border-[#2C194D] rounded-xl p-2 font-medium"
                        >
                          <option value="LOW">Low (Fastest)</option>
                          <option value="MEDIUM">Medium (Balanced)</option>
                          <option value="HIGH">High (Deepest)</option>
                        </select>
                      </div>

                      <div className="flex flex-row items-center justify-between">
                        <label className="text-sm text-[#F5E1C8] font-bold">Show Thought Process</label>
                        <input
                          type="checkbox"
                          checked={settings.includeThoughts ?? true}
                          onChange={e => onSave({ includeThoughts: e.target.checked })}
                          className="w-5 h-5 accent-[#F198B7] cursor-pointer"
                        />
                      </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/Settings.tsx', code);
console.log("Settings patched");
