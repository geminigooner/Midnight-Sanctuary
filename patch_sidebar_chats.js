import fs from 'fs';
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const target1 = `interface SidebarProps {
  conversations: Conversation[];
  currentId: string | null;`;

const replacement1 = `interface SidebarProps {
  conversations: Conversation[];
  currentId: string | null;
  currentModel: string;`;
code = code.replace(target1, replacement1);

const target2 = `export function Sidebar({ conversations, currentId, onSelect, onNew, onDelete, onRename, isOpen }: SidebarProps) {`;
const replacement2 = `export function Sidebar({ conversations, currentId, currentModel, onSelect, onNew, onDelete, onRename, isOpen }: SidebarProps) {`;
code = code.replace(target2, replacement2);

const target3 = `  const filtered = conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.messages.some(m => m.parts?.[0]?.text?.toLowerCase().includes(search.toLowerCase())));`;
const replacement3 = `  const filtered = conversations.filter(c => 
    (c.modelId === currentModel || (!c.modelId && currentModel.includes('gemma'))) && // Legacy conversations default to Gemma
    (c.title.toLowerCase().includes(search.toLowerCase()) || c.messages.some(m => m.parts?.[0]?.text?.toLowerCase().includes(search.toLowerCase())))
  );`;
code = code.replace(target3, replacement3);

fs.writeFileSync('src/components/Sidebar.tsx', code);
