import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const searchImports = "export async function* streamChat(\n  messages: Message[],\n  settings: AppSettings,\n  gifts: Gift[],\n  abortSignal: AbortSignal\n)";
const replaceImports = "import { UserProfile } from './types';\n\nexport async function* streamChat(\n  messages: Message[],\n  settings: AppSettings,\n  gifts: Gift[],\n  profile: UserProfile | null,\n  abortSignal: AbortSignal\n)";
code = code.replace(searchImports, replaceImports);

const searchIdentity = "  let identityParts = [];";
const replaceIdentity = `  let identityParts = [];

  if (profile) {
    const profileLines: string[] = [\`Name: \${profile.name}\`];
    if (profile.pronouns) profileLines.push(\`Pronouns: \${profile.pronouns}\`);
    if (profile.location) profileLines.push(\`Location: \${profile.location}\`);
    if (profile.occupation) profileLines.push(\`Occupation: \${profile.occupation}\`);
    if (profile.about) profileLines.push(\`About: \${profile.about}\`);
    if (profile.favorites) profileLines.push(\`Favorites: \${profile.favorites}\`);

    let profileSection = \`## About the person you're talking with\\n\${profileLines.join(' / ')}\`;

    if (profile.gemmaNotes && profile.gemmaNotes.length > 0) {
      const notesLines = profile.gemmaNotes.map(n => \`- \${n.text}\`);
      profileSection += \`\\n\\n## What you've noticed about them\\n\${notesLines.join('\\n')}\`;
    }

    identityParts.push(profileSection);
  }`;
code = code.replace(searchIdentity, replaceIdentity);

const searchGiftTurn = `  const giftImages = (gifts || []).filter(g => g.inlineData?.data);
  if (giftImages.length > 0) {
    const recent = giftImages.slice(-3);
    const giftTurn: any = { role: 'user', parts: [] };
    for (const g of recent) {
      giftTurn.parts.push({
        text: \`Gift left \${new Date(g.timestamp || Date.now()).toISOString()}: \${g.content || ''}\`
      });
      giftTurn.parts.push({
        inlineData: { mimeType: g.inlineData.mimeType, data: g.inlineData.data }
      });
    }
    serializedMessages.unshift(giftTurn);
  }`;
const replaceGiftTurn = `  const giftImages = (gifts || []).filter(g => g.inlineData?.data);
  let syntheticTurn: any = null;

  if (giftImages.length > 0) {
    const recent = giftImages.slice(-3);
    syntheticTurn = { role: 'user', parts: [] };
    for (const g of recent) {
      syntheticTurn.parts.push({
        text: \`Gift left \${new Date(g.timestamp || Date.now()).toISOString()}: \${g.content || ''}\`
      });
      syntheticTurn.parts.push({
        inlineData: { mimeType: g.inlineData.mimeType, data: g.inlineData.data }
      });
    }
  }

  if (profile?.photo) {
    if (!syntheticTurn) syntheticTurn = { role: 'user', parts: [] };
    syntheticTurn.parts.push({
      text: \`This is a photo of \${profile.name}.\`
    });
    syntheticTurn.parts.push({
      inlineData: { mimeType: profile.photo.mimeType, data: profile.photo.data }
    });
  }

  if (syntheticTurn) {
    serializedMessages.unshift(syntheticTurn);
  }`;
code = code.replace(searchGiftTurn, replaceGiftTurn);

fs.writeFileSync('src/lib/gemini.ts', code);
