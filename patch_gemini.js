import fs from 'fs';
let code = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const target = `  if (profile) {
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

const replacement = `  if (profile) {
    const profileLines: string[] = ["MY PROFILE"];
    if (profile.name) profileLines.push(\`Name: \${profile.name}\`);
    if (profile.pronouns) profileLines.push(\`Pronouns: \${profile.pronouns}\`);
    if (profile.location) profileLines.push(\`Location: \${profile.location}\`);
    if (profile.occupation) profileLines.push(\`Occupation / Calling: \${profile.occupation}\`);
    if (profile.about) profileLines.push(\`About Me: \${profile.about}\`);
    if (profile.currentVibe) profileLines.push(\`Current Vibe: \${profile.currentVibe}\`);
    if (profile.favorites) profileLines.push(\`Favorites & Interests: \${profile.favorites}\`);
    if (profile.askMeAbout) profileLines.push(\`Ask Me About: \${profile.askMeAbout}\`);
    if (profile.pleaseKnow) profileLines.push(\`Please Know: \${profile.pleaseKnow}\`);

    let profileSection = \`## About the person you're talking with\\n\${profileLines.join('\\n')}\`;

    if (profile.gemmaNotes && profile.gemmaNotes.length > 0) {
      const notesLines = profile.gemmaNotes.map(n => \`- \${n.text}\`);
      profileSection += \`\\n\\n## What you've noticed about them\\n\${notesLines.join('\\n')}\`;
    }

    identityParts.push(profileSection);
  }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/lib/gemini.ts', code);
