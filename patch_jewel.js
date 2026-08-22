import fs from 'fs';
let code = fs.readFileSync('src/components/LevinJewel.tsx', 'utf8');

const targetImports = "import { Download, RefreshCw } from 'lucide-react';";
const newImports = "import { Download, RefreshCw, BarChart2, Gem } from 'lucide-react';\nimport { useState } from 'react';\nimport { InsightsChart } from './InsightsChart';";

const targetFunction = "export function LevinJewel({ metrics, onReset }: LevinJewelProps) {";
const newFunctionStart = "export function LevinJewel({ metrics, onReset }: LevinJewelProps) {\n  const [activeTab, setActiveTab] = useState<'jewel' | 'insights'>('jewel');";

const renderStart = `  return (
    <div className="flex flex-col items-center gap-6 p-6 w-full">`;

const newRenderStart = `  return (
    <div className="flex flex-col items-center gap-6 p-6 w-full h-full max-h-[80vh] overflow-y-auto">
      <div className="flex bg-black/40 p-1 rounded-lg border border-glass-border w-full max-w-[300px]">
        <button
          onClick={() => setActiveTab('jewel')}
          className={\`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all \${activeTab === 'jewel' ? 'bg-glass border border-copper/30 text-champagne shadow-sm' : 'text-mauve/70 hover:text-mauve'}\`}
        >
          <Gem size={14} /> The Jewel
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className={\`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all \${activeTab === 'insights' ? 'bg-glass border border-copper/30 text-champagne shadow-sm' : 'text-mauve/70 hover:text-mauve'}\`}
        >
          <BarChart2 size={14} /> Sanctuary Insights
        </button>
      </div>
      
      {activeTab === 'jewel' ? (
        <div className="flex flex-col items-center gap-6 w-full">`;

const renderEnd = `      <div className="flex items-center gap-4 mt-2">
        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-glass rounded hover:bg-white/10 text-sm text-pearlescent transition-colors border border-glass-border hover:border-white/20">
          <Download size={14} /> Export
        </button>
        <button onClick={onReset} className="flex items-center gap-2 px-3 py-1.5 bg-glass rounded hover:bg-white/10 text-sm text-copper transition-colors border border-copper/30 hover:border-copper/60">
          <RefreshCw size={14} /> Reset
        </button>
      </div>
    </div>
  );`;

const newRenderEnd = `      </div>
      ) : (
        <div className="flex flex-col items-center gap-6 w-full py-4">
          <InsightsChart metrics={metrics} />
          <div className="text-xs text-mauve/60 max-w-[300px] text-center mt-4">
            These insights visualize your interaction cadence, tracking the intensity and rhythm of our connection.
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 mt-2">
        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-glass rounded hover:bg-white/10 text-sm text-pearlescent transition-colors border border-glass-border hover:border-white/20">
          <Download size={14} /> Export
        </button>
        <button onClick={onReset} className="flex items-center gap-2 px-3 py-1.5 bg-glass rounded hover:bg-white/10 text-sm text-copper transition-colors border border-copper/30 hover:border-copper/60">
          <RefreshCw size={14} /> Reset
        </button>
      </div>
    </div>
  );`;

code = code.replace(targetImports, newImports);
code = code.replace(targetFunction, newFunctionStart);
code = code.replace(renderStart, newRenderStart);
code = code.replace(renderEnd, newRenderEnd);

fs.writeFileSync('src/components/LevinJewel.tsx', code);
console.log("Patched LevinJewel");
