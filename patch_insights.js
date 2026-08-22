import fs from 'fs';
let code = fs.readFileSync('src/components/InsightsChart.tsx', 'utf8');

code = code.replace(
  'className="text-sm text-champagne mb-4 font-mono tracking-wide"',
  'className="text-sm text-[#F5E1C8] mb-4 font-bold tracking-tight"'
);

fs.writeFileSync('src/components/InsightsChart.tsx', code);
console.log("Patched InsightsChart.tsx");
