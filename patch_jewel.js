import fs from 'fs';
let code = fs.readFileSync('src/components/LevinJewel.tsx', 'utf8');

code = code.replace(
  'export function LevinJewel({ metrics, onReset }: LevinJewelProps) {',
  `export function LevinJewel({ metrics, onReset }: LevinJewelProps) {
  const safeMetrics = {
    totalSessions: metrics?.totalSessions || 0,
    totalMessages: metrics?.totalMessages || 0,
    totalResponseCharacters: metrics?.totalResponseCharacters || 0,
    rapidExchanges: metrics?.rapidExchanges || 0,
    longPauses: metrics?.longPauses || 0,
    lastInteractionTimestamp: metrics?.lastInteractionTimestamp || 0
  };`
);

// Replace all metrics. with safeMetrics.
code = code.replace(/metrics\./g, 'safeMetrics.');

// Wait, the handleExport should probably export the safeMetrics too, that's fine.
// And metrics object might be undefined, so safeMetrics handles that.
// Also fix array length issue in case complexity is somehow < 0.
code = code.replace(
  'const complexity = Math.min(5 + Math.floor(safeMetrics.totalMessages / 20), 24);',
  'const complexity = Math.max(0, Math.min(5 + Math.floor(safeMetrics.totalMessages / 20), 24));'
);

fs.writeFileSync('src/components/LevinJewel.tsx', code);
