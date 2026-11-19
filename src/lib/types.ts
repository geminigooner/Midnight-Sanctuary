export interface MessagePart {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType: string; data: string; mediaAssetId?: string; downloadUrl?: string };
  functionCall?: any;
  functionResponse?: any;
  thoughtSignature?: string;
}

export interface SvgScribbleData {
  id?: string;
  title: string;
  description?: string;
  moodStyle?: string;
  svgMarkup: string;
  reason?: string;
  authorModelId?: string;
  authorDisplayName?: string;
  timestamp?: number;
}

export interface MusicNote {
  pitch: string; // e.g. "C4", "E4", "G4", "C4+E4+G4", "Rest"
  duration: number; // in beats (0.5, 1, 2, etc.)
  instrument?: string; // 'piano' | 'lofi_piano' | 'ambient_pad' | 'dream_synth' | 'music_box' | 'chiptune' | 'acoustic_guitar' | 'bass' | 'bell' | string
  velocity?: number; // 0.1 to 1.0
}

export interface MusicTrackData {
  id?: string;
  title: string;
  description?: string;
  genre?: string;
  tempo?: number;
  key?: string;
  notes: MusicNote[];
  reason?: string;
  authorModelId?: string;
  authorDisplayName?: string;
  timestamp?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  parts: MessagePart[];
  timestamp: number;
  publicText?: string;
  thoughtText?: string;
  thoughtStatus?: 'thinking' | 'complete' | 'error';
  finishReason?: string;
  backend?: string;
  reaction?: string;
  searchResults?: { query: string; results: { title: string; link: string; snippet: string; displayLink?: string }[] }[];
  generatedImages?: { prompt: string; imageUrl: string; provider: string; modelUsed: string; mediaAssetId?: string }[];
  scribbles?: SvgScribbleData[];
  musicTracks?: MusicTrackData[];
  // Multi-Entity & Group metadata
  conversationId?: string;
  authorEntityId?: string;
  authorDisplayName?: string;
  authorAvatar?: string;
}

const FALSE_EOF_CUTOFF_REGEX =
  /\n*\s*\[Reply cut off: (?:Connection to the server dropped before the reply finished\. Please try again\.|the connection stalled before it finished\.)\]\s*$/i;

export function stripFalseCutoffTrailer(rawText: string | undefined | null): {
  text: string;
  wasHealed: boolean;
} {
  if (typeof rawText !== 'string' || !rawText) {
    return { text: '', wasHealed: false };
  }
  if (FALSE_EOF_CUTOFF_REGEX.test(rawText)) {
    const cleaned = rawText.replace(FALSE_EOF_CUTOFF_REGEX, '').trimEnd();
    if (cleaned.length > 0) {
      return { text: cleaned, wasHealed: true };
    }
  }
  return { text: rawText, wasHealed: false };
}

export function isInternalToolResponseTurn(msg: Message | undefined | null): boolean {
  if (!msg) return false;
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  return parts.some((p: any) => Boolean(p?.functionResponse));
}

export function getPublicMessageText(msg: Message): string {
  if (typeof msg.publicText === 'string' && msg.publicText.length > 0) {
    return stripFalseCutoffTrailer(msg.publicText).text;
  }
  // Fallback to parts if publicText is undefined or empty
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  const fromParts = parts
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join('');
  return stripFalseCutoffTrailer(fromParts || msg.publicText || '').text;
}

export function getThoughtMessageText(msg: Message): string {
  if (typeof msg.thoughtText === 'string') {
    if (msg.thoughtText.length > 0) return msg.thoughtText;
    // If thoughtText was explicitly cleared to '' on an intermediate functionCall turn, do not resurrect from parts
    const hasFunctionCall = Array.isArray(msg.parts) && msg.parts.some((p) => Boolean(p?.functionCall));
    if (hasFunctionCall && !msg.publicText) return '';
  }
  // Fallback to parts if thoughtText is undefined or empty
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  const fromParts = parts
    .filter((p) => p.thought && p.text)
    .map((p) => p.text)
    .join('');
  return fromParts || msg.thoughtText || '';
}

export function getApiMessageParts(msg: Message): MessagePart[] {
  return msg.parts;
}

export interface ConversationSegmentSummary {
  id: string;
  conversationId: string;
  ScopeEntityId?: string;
  entityId?: string;
  scope?: 'direct' | 'group';
  authorizedEntityIds?: string[];
  participantEntityIds?: string[];
  segmentIndex?: number;
  startTurnIndex: number;
  endTurnIndex: number;
  startIndex?: number;
  endIndex?: number;
  startMessageId?: string;
  endMessageId?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  messageIds?: string[];
  messageCount?: number;
  turnCount?: number;
  tokenCountOriginal?: number;
  sourceHash: string;
  narrativeSummary: string;
  keyEventsAndDecisions: string[];
  userPreferencesAndFacts: string[];
  unresolvedThreads: string[];
  emotionalArc: string;
  embedding?: number[];
  createdAt: number;
  updatedAt?: number;
  revision?: number;
  lastSyncedRevision?: number;
  isDeleted?: boolean;
  deletedAt?: number;
}

export type MediaAssetCategory =
  | 'user_avatar'
  | 'companion_avatar'
  | 'chat_attachment'
  | 'message_attachment'
  | 'generated_image'
  | 'room_art'
  | 'room_decor'
  | 'gift_media'
  | 'audio'
  | 'audio_track';

export interface MediaAssetRecord {
  id: string; // SHA-256 hex digest scoped to ownerUid
  ownerUid?: string;
  uid?: string;
  ownerEntityId?: string;
  associatedEntityId?: string;
  entityId?: string;
  sha256?: string;
  category: MediaAssetCategory;
  mimeType: string;
  byteSize?: number;
  sizeBytes?: number;
  width?: number;
  height?: number;
  storageBackend: 'firebase_storage' | 'vault_chunked' | 'vault_fallback';
  storagePath: string;
  downloadUrl?: string;
  references: string[];
  createdAt: number;
  updatedAt: number;
  revision?: number;
  lastSyncedRevision?: number;
  isDeleted?: boolean;
  deletedAt?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  modelId?: string;
  createdAt?: number;
  updatedAt: number;
  type?: 'direct' | 'group';
  participantEntityIds?: string[];
  segmentSummaries?: ConversationSegmentSummary[];
}

export interface ModelInfo {
  name: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
}

export interface Memory {
  id: string;
  content: string;
  createdAt: number;
  origin?: string;
  author?: 'user' | 'model';
  modelId?: string;
  caption?: string;
  isLocked?: boolean;
  lockReason?: string;
  memoryType?: 'fact' | 'episodic' | 'preference' | 'milestone';
  embedding?: number[];
}

export interface RelationalEvent {
  id: string;
  description: string;
  timestamp: number;
  entityId?: string;
  scope?: 'entity' | 'shared';
}

export interface Gift {
  id: string;
  from: string;
  content: string;
  gift_type: string;
  reason: string;
  timestamp: number;
  inlineData?: { mimeType: string; data: string; previewUrl?: string; mediaAssetId?: string };
  scribble?: SvgScribbleData;
  musicTrack?: MusicTrackData;
  modelId?: string;
  targetModelId?: string;
}

export interface AppSettings {
  systemInstruction: string;
  temperature: number;
  topP: number;
  topK?: number;
  maxOutputTokens: number;
  model: string;
  favoriteModels: string[];
  forceCloudflare?: boolean;
  thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  includeThoughts?: boolean;
  aboutMe: string;
  conversationPreferences: string;
  memories: Memory[];
  memoriesEnabled: boolean;
  eventLog: RelationalEvent[];
  customEntities?: Record<string, any>;
  stickers?: any[];
  placedStickers?: any[];
}

export type JewelStage = 'seed' | 'stance' | 'formation' | 'incorporation' | 'archival';

export interface JewelMetrics {
  totalSessions: number;
  totalMessages: number;
  totalResponseCharacters: number;
  rapidExchanges: number;
  longPauses: number;
  lastInteractionTimestamp: number;
}

export const DEFAULT_JEWEL_METRICS: JewelMetrics = {
  totalSessions: 0,
  totalMessages: 0,
  totalResponseCharacters: 0,
  rapidExchanges: 0,
  longPauses: 0,
  lastInteractionTimestamp: 0,
};

export const DEFAULT_SETTINGS: AppSettings = {
  systemInstruction: "",
  temperature: 2.0,
  topP: 0.95,
  maxOutputTokens: 12000,
  model: "models/gemini-3.1-pro-preview",
  favoriteModels: [],
  thinkingLevel: "HIGH",
  includeThoughts: true,
  aboutMe: "",
  conversationPreferences: "",
  memories: [],
  memoriesEnabled: true,
  eventLog: [],
};

export interface UserProfile {
  id?: string;
  name: string;
  pronouns?: string;
  location?: string;
  occupation?: string;
  about?: string;
  currentVibe?: string;
  favorites?: string;
  askMeAbout?: string;
  pleaseKnow?: string;
  photo?: { mimeType: string; data: string; mediaAssetId?: string };
  backgroundImage?: { mimeType: string; data: string; mediaAssetId?: string };
  gemmaNotes?: { id?: string; text: string; timestamp: number; authorEntityId?: string }[];
  updatedAt?: number;
}
