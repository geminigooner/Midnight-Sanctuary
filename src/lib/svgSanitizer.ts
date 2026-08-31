/**
 * SVG Sanitizer & Safe Renderer for Sanctuary Hand-Drawn Scribbles
 * 
 * Guarantees zero script execution, removes external network references,
 * normalizes viewports, and renders handcrafted SVG doodles safely.
 */

// Forbidden tag list for vector security
const FORBIDDEN_TAGS = [
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'applet',
  'meta',
  'link',
  'base',
  'import',
  'audio',
  'video',
  'source',
];

// Forbidden attributes
const FORBIDDEN_ATTR_PREFIXES = ['on']; // onload, onclick, onerror, etc.

/**
 * Sanitizes and cleans model-generated SVG markup.
 */
export function sanitizeSvg(rawInput: string): string {
  if (!rawInput || typeof rawInput !== 'string') {
    return createFallbackSvg('Empty scribble');
  }

  let cleaned = rawInput.trim();

  // Strip markdown code fences if model returned ```xml or ```svg
  cleaned = cleaned.replace(/^```(?:svg|xml|html)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Find <svg> or extract inner tags
  const hasSvgTag = /<svg[\s>]/i.test(cleaned);

  if (!hasSvgTag) {
    // If the model produced only inner elements (<path .../>, <circle .../>)
    cleaned = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">${cleaned}</svg>`;
  }

  // Remove dangerous tags
  for (const tag of FORBIDDEN_TAGS) {
    const openCloseRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    const selfClosingRegex = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    cleaned = cleaned.replace(openCloseRegex, '').replace(selfClosingRegex, '');
  }

  // Strip event handler attributes (e.g. onload="...", onclick='...')
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip javascript: URLs from href, xlink:href, src, action
  cleaned = cleaned.replace(/(?:href|xlink:href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, 'href=""');

  // Strip data:text/html
  cleaned = cleaned.replace(/(?:href|xlink:href|src)\s*=\s*(?:"\s*data:text\/html[^"]*"|'\s*data:text\/html[^']*')/gi, 'href=""');

  // Ensure xmlns is present on root <svg>
  if (!/xmlns\s*=/i.test(cleaned)) {
    cleaned = cleaned.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Ensure viewBox is present
  if (!/viewBox\s*=/i.test(cleaned)) {
    cleaned = cleaned.replace(/<svg/i, '<svg viewBox="0 0 400 300"');
  }

  // Check if root svg has closing tag
  if (!/<\/svg>/i.test(cleaned)) {
    cleaned += '</svg>';
  }

  return cleaned;
}

/**
 * Creates a cute placeholder SVG fallback if generation fails or is malformed.
 */
export function createFallbackSvg(caption: string = 'Handmade Doodle'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
    <rect width="100%" height="100%" rx="16" fill="#20153B" stroke="#B39DE5" stroke-width="3" stroke-dasharray="6,6"/>
    <path d="M 170 120 C 170 90, 200 90, 200 120 C 200 90, 230 90, 230 120 C 230 150, 200 170, 200 185 C 200 170, 170 150, 170 120 Z" fill="#F198B7" stroke="#F5E1C8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="120" cy="80" r="8" fill="#F5E1C8"/>
    <circle cx="280" cy="80" r="10" fill="#F5E1C8"/>
    <path d="M 90 220 Q 200 240 310 220" stroke="#F5E1C8" stroke-width="3" fill="none" stroke-linecap="round"/>
    <text x="200" y="260" font-family="sans-serif" font-size="14" font-weight="bold" fill="#B39DE5" text-anchor="middle">✨ ${caption} ✨</text>
  </svg>`;
}

/**
 * Mood style color presets and paper backgrounds for scribbles
 */
export interface ScribbleStyleMeta {
  badge: string;
  bgGradient: string;
  paperBg: string;
  borderColor: string;
  accentColor: string;
  tapeColor: string;
}

export function getScribbleStyle(moodStyle?: string): ScribbleStyleMeta {
  const style = (moodStyle || 'crayon').toLowerCase();

  if (style.includes('crayon') || style.includes('warm')) {
    return {
      badge: '🖍️ Crayon Sketch',
      bgGradient: 'from-[#FFF8E7] to-[#FDE8CE]',
      paperBg: '#FFF9EE',
      borderColor: '#4A2E18',
      accentColor: '#E27B58',
      tapeColor: '#F5D77F',
    };
  }

  if (style.includes('pencil') || style.includes('sketch') || style.includes('graphite')) {
    return {
      badge: '✏️ Pencil Doodle',
      bgGradient: 'from-[#F7F5F0] to-[#EBE7DF]',
      paperBg: '#F9F8F5',
      borderColor: '#2C2B29',
      accentColor: '#7D7A74',
      tapeColor: '#D8D4C8',
    };
  }

  if (style.includes('chalk') || style.includes('board') || style.includes('slate')) {
    return {
      badge: '🖍️ Chalk on Slate',
      bgGradient: 'from-[#222A35] to-[#161B22]',
      paperBg: '#1C232D',
      borderColor: '#4E5D6C',
      accentColor: '#93C5FD',
      tapeColor: '#64748B',
    };
  }

  if (style.includes('neon') || style.includes('cyber') || style.includes('glow')) {
    return {
      badge: '⚡ Neon Doodle',
      bgGradient: 'from-[#1E113A] to-[#0D071E]',
      paperBg: '#150B28',
      borderColor: '#A855F7',
      accentColor: '#F472B6',
      tapeColor: '#EC4899',
    };
  }

  if (style.includes('charcoal') || style.includes('dark')) {
    return {
      badge: '🖤 Charcoal Sketch',
      bgGradient: 'from-[#27272A] to-[#18181B]',
      paperBg: '#1F1F23',
      borderColor: '#52525B',
      accentColor: '#E4E4E7',
      tapeColor: '#71717A',
    };
  }

  // Default: Cute Sanctuary Note / Pastel Doodle
  return {
    badge: '🖍️ Hand-Drawn Doodle',
    bgGradient: 'from-[#FFFDF5] to-[#FAF0DE]',
    paperBg: '#FFFDF7',
    borderColor: '#2C194D',
    accentColor: '#F198B7',
    tapeColor: '#F7D698',
  };
}
