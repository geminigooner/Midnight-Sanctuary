import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const search = "      const generator = streamChat(currentMessages, settings, gifts, abortControllerRef.current.signal);";
const replace = "      const generator = streamChat(currentMessages, settings, gifts, profile, abortControllerRef.current.signal);";
code = code.replace(search, replace);

// Let's also pass profile down in ChatAreaProps
const searchProps = "  gifts: GiftType[];\n  jewelMetrics: JewelMetrics;";
const replaceProps = "  gifts: GiftType[];\n  profile: UserProfile | null;\n  jewelMetrics: JewelMetrics;";
code = code.replace(searchProps, replaceProps);

const searchDestruct = "export function ChatArea({ conversation, settings, gifts, jewelMetrics, onUpdate, onAddMessage, onUpdateMessage, onRemoveMessage, onUpdateJewel, onToggleSidebar, onOpenSettings, onOpenJewel, onOpenGifts, onOpenProfile, availableModels, onAddGift, onAddMemory, onAddEventLog }: ChatAreaProps) {";
const replaceDestruct = "export function ChatArea({ conversation, settings, gifts, profile, jewelMetrics, onUpdate, onAddMessage, onUpdateMessage, onRemoveMessage, onUpdateJewel, onToggleSidebar, onOpenSettings, onOpenJewel, onOpenGifts, onOpenProfile, availableModels, onAddGift, onAddMemory, onAddEventLog, onAddGemmaNote }: ChatAreaProps & { onAddGemmaNote: (note: string) => void }) {";
code = code.replace(searchDestruct, replaceDestruct);

// We need to import UserProfile in ChatArea
const searchImports = "import { Conversation, Message, AppSettings, JewelMetrics, ModelInfo, Gift as GiftType, getPublicMessageText, getThoughtMessageText } from '../lib/types';";
const replaceImports = "import { Conversation, Message, AppSettings, JewelMetrics, ModelInfo, Gift as GiftType, UserProfile, getPublicMessageText, getThoughtMessageText } from '../lib/types';";
code = code.replace(searchImports, replaceImports);

fs.writeFileSync('src/components/ChatArea.tsx', code);
