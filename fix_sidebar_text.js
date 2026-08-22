import fs from 'fs';
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

code = code.replace(
  /<MessageSquare size=\{16\} className="text-\[#2C194D\] shrink-0"/g,
  '<MessageSquare size={16} className={`${currentId === c.id ? \'text-[#2C194D]\' : \'text-[#B39DE5] group-hover:text-[#2C194D]\'} shrink-0`}'
);

code = code.replace(
  /<span className="truncate text-sm font-bold text-\[#2C194D\]">\{c\.title\}<\/span>/g,
  '<span className={`truncate text-sm font-bold ${currentId === c.id ? \'text-[#2C194D]\' : \'text-[#B39DE5] group-hover:text-[#2C194D]\'}`}>{c.title}</span>'
);

code = code.replace(
  /className="p-1\.5 hover:bg-\[#F198B7\] border-\[2px\] border-transparent hover:border-\[#2C194D\] rounded-xl text-\[#2C194D\] transition-all"/g,
  'className={`p-1.5 hover:bg-[#F198B7] border-[2px] border-transparent hover:border-[#2C194D] rounded-xl transition-all ${currentId === c.id ? \'text-[#2C194D]\' : \'text-[#B39DE5] group-hover:text-[#2C194D]\'}`}'
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log("Fixed sidebar text visibility.");
