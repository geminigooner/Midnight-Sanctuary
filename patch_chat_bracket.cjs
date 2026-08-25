const fs = require('fs');
let code = fs.readFileSync('src/backend/chatHandler.ts', 'utf8');

const target = `            }
          } catch (e: any) {`;

const replacement = `            }
            } // close for await
          } catch (e: any) {`;

code = code.replace(target, replacement);

fs.writeFileSync('src/backend/chatHandler.ts', code);
