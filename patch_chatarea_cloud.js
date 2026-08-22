import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const newSvg = `<div className="relative mb-6">
  <svg width="150" height="150" viewBox="0 0 150 150" className="drop-shadow-[6px_6px_0_rgba(44,25,77,1)] hover:scale-105 transition-transform duration-500">
    <defs>
      <linearGradient id="cloudGrad" x1="10%" y1="90%" x2="90%" y2="10%">
        <stop offset="0%" stopColor="#3B28CC" />
        <stop offset="40%" stopColor="#8B5CF6" />
        <stop offset="75%" stopColor="#FF9EBB" />
        <stop offset="100%" stopColor="#FBCFE8" />
      </linearGradient>
    </defs>
    
    {/* Outer stroke group */}
    <g stroke="#2C194D" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" fill="#2C194D">
      <circle cx="75" cy="75" r="45" />
      <circle cx="113" cy="75" r="25" />
      <circle cx="102" cy="102" r="23" />
      <circle cx="75" cy="113" r="22" />
      <circle cx="48" cy="102" r="24" />
      <circle cx="37" cy="75" r="25" />
      <circle cx="48" cy="48" r="23" />
      <circle cx="75" cy="37" r="22" />
      <circle cx="102" cy="48" r="24" />
    </g>

    {/* Inner gradient fill group */}
    <g fill="url(#cloudGrad)">
      <circle cx="75" cy="75" r="45" />
      <circle cx="113" cy="75" r="25" />
      <circle cx="102" cy="102" r="23" />
      <circle cx="75" cy="113" r="22" />
      <circle cx="48" cy="102" r="24" />
      <circle cx="37" cy="75" r="25" />
      <circle cx="48" cy="48" r="23" />
      <circle cx="75" cy="37" r="22" />
      <circle cx="102" cy="48" r="24" />
    </g>

    {/* Face details */}
    {/* Blush */}
    <ellipse cx="46" cy="85" rx="7" ry="5" fill="#FF9EBB" opacity="0.9" />
    <ellipse cx="104" cy="85" rx="7" ry="5" fill="#FF9EBB" opacity="0.9" />
    
    {/* Eyes */}
    <circle cx="58" cy="78" r="4.5" fill="#2C194D" />
    <circle cx="92" cy="78" r="4.5" fill="#2C194D" />
    
    {/* Mouth 'w' */}
    <path d="M 68 81 Q 71.5 86 75 82 Q 78.5 86 82 81" fill="none" stroke="#2C194D" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
</div>`;

const searchString = `<div className="relative mb-6">
                <div className="absolute -top-4 -left-6 text-[#F5E1C8] text-2xl font-bold rotate-[-15deg]">\\]</div\\>
                <div className="absolute -top-6 left-2 text-[#F5E1C8] text-2xl font-bold">|</div>
                <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#2C194D" strokeWidth="1.5" className="drop-shadow-[4px_4px_0_rgba(44,25,77,0.5)]">
                   <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#9D7FE3" />
                   <circle cx="8" cy="10" r="1.5" fill="#2C194D" stroke="none" />
                   <circle cx="12" cy="10" r="1.5" fill="#2C194D" stroke="none" />
                   <circle cx="16" cy="10" r="1.5" fill="#2C194D" stroke="none" />
                </svg>
                <div className="absolute -bottom-2 -right-4">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="#F198B7" stroke="#2C194D" strokeWidth="2" className="drop-shadow-[2px_2px_0_rgba(44,25,77,0.5)]">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                </div>
             </div>`;

// Since it might be hard to match the exact spacing, I'll use a regex replacement.
code = code.replace(/<div className="relative mb-6">[\s\S]*?<\/svg>\s*<\/div>\s*<\/div>/, newSvg);

fs.writeFileSync('src/components/ChatArea.tsx', code);
console.log("Patched ChatArea.tsx with cloud");
