/**
 * Deterministic Local Procedural Sanctuary Art Generator.
 *
 * Replaces third-party `picsum.photos` network calls (W-09 fix) with zero-leakage,
 * offline-capable, atmospheric SVG data-URLs tailored to the companion's theme and prompt.
 */

function fnv1aHash(str: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const PALETTES: [string, string, string, string][] = [
  ['#0f0c29', '#302b63', '#24243e', '#a78bfa'],
  ['#090d16', '#1e1b4b', '#311042', '#f472b6'],
  ['#06141f', '#0f3443', '#1a2980', '#38bdf8'],
  ['#140b1c', '#2c1654', '#4a154b', '#fbbf24'],
  ['#071a14', '#134e4a', '#1e293b', '#34d399'],
];

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateProceduralSanctuaryArt(
  promptOrTitle: string,
  entityKey?: string
): string {
  const seedInput = `${entityKey || 'sanctuary'}:${promptOrTitle || 'Midnight Sanctuary'}`;
  const h1 = fnv1aHash(seedInput, 2166136261);
  const h2 = fnv1aHash(seedInput, 1469598103);

  const palette = PALETTES[h1 % PALETTES.length];
  const [bgStart, bgMid, bgEnd, accent] = palette;

  const orb1X = 180 + (h1 % 440);
  const orb1Y = 120 + ((h1 >>> 8) % 300);
  const orb2X = 140 + (h2 % 500);
  const orb2Y = 150 + ((h2 >>> 8) % 320);

  const stars: string[] = [];
  for (let i = 0; i < 24; i++) {
    const sh = fnv1aHash(`${seedInput}:star:${i}`);
    const sx = 40 + (sh % 720);
    const sy = 30 + ((sh >>> 10) % 480);
    const sr = 1 + ((sh >>> 20) % 3) * 0.7;
    const op = (0.25 + ((sh & 0xff) / 255) * 0.65).toFixed(2);
    stars.push(`<circle cx="${sx}" cy="${sy}" r="${sr}" fill="#ffffff" opacity="${op}" />`);
  }

  const cleanCaption = escapeXml((promptOrTitle || 'Sanctuary Vision').slice(0, 64));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgStart}" />
        <stop offset="55%" stop-color="${bgMid}" />
        <stop offset="100%" stop-color="${bgEnd}" />
      </linearGradient>
      <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.48" />
        <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="800" height="600" fill="url(#bg)" />
    <circle cx="${orb1X}" cy="${orb1Y}" r="240" fill="url(#glow1)" />
    <circle cx="${orb2X}" cy="${orb2Y}" r="180" fill="url(#glow2)" />
    ${stars.join('\n    ')}
    <path d="M 0 460 Q 220 ${380 + (h1 % 60)} 440 450 T 800 430 L 800 600 L 0 600 Z" fill="#07070c" opacity="0.55" />
    <path d="M 0 510 Q 300 ${450 + (h2 % 50)} 560 505 T 800 495 L 800 600 L 0 600 Z" fill="#040408" opacity="0.82" />
    <text x="40" y="562" fill="#e2e8f0" opacity="0.72" font-family="serif" font-size="16" letter-spacing="1">${cleanCaption}</text>
  </svg>`;

  if (typeof Buffer !== 'undefined') {
    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
  }
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
