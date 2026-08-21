import fs from 'fs';
let code = fs.readFileSync('src/components/Settings.tsx', 'utf8');

const target = `{sortedModels.map(m => (
                    <option key={m.name} value={m.name}>
                      {settings.favoriteModels?.includes(m.name) ? '★ ' : ''}{m.displayName}
                    </option>
                  ))}`;

const replacement = `{(() => {
                    const favorites = sortedModels.filter(m => settings.favoriteModels?.includes(m.name));
                    const gemmas = sortedModels.filter(m => m.name.toLowerCase().includes('gemma') && !settings.favoriteModels?.includes(m.name));
                    const geminis = sortedModels.filter(m => m.name.toLowerCase().includes('gemini') && !settings.favoriteModels?.includes(m.name));
                    const others = sortedModels.filter(m => !m.name.toLowerCase().includes('gemma') && !m.name.toLowerCase().includes('gemini') && !settings.favoriteModels?.includes(m.name));
                    
                    return (
                      <>
                        {favorites.length > 0 && (
                          <optgroup label="Favorites">
                            {favorites.map(m => (
                              <option key={m.name} value={m.name}>★ {m.displayName}</option>
                            ))}
                          </optgroup>
                        )}
                        {gemmas.length > 0 && (
                          <optgroup label="Gemma Models">
                            {gemmas.map(m => (
                              <option key={m.name} value={m.name}>{m.displayName}</option>
                            ))}
                          </optgroup>
                        )}
                        {geminis.length > 0 && (
                          <optgroup label="Gemini Models">
                            {geminis.map(m => (
                              <option key={m.name} value={m.name}>{m.displayName}</option>
                            ))}
                          </optgroup>
                        )}
                        {others.length > 0 && (
                          <optgroup label="Other Models">
                            {others.map(m => (
                              <option key={m.name} value={m.name}>{m.displayName}</option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/Settings.tsx', code);
console.log("Patched settings");
