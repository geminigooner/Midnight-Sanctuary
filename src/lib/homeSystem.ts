import { UserProfile, JewelMetrics, Gift, Memory } from './types';
import { calculateJewelLevel } from './jewelSystem';

export interface TimeGreetingInfo {
  greeting: string;
  subtext: string;
  icon: string;
  period: 'morning' | 'afternoon' | 'evening' | 'night';
}

export function getTimeGreeting(profile?: UserProfile | null): TimeGreetingInfo {
  const hour = new Date().getHours();
  const rawName = profile?.name?.trim();
  const displayName = rawName && rawName.toLowerCase() !== 'user' ? rawName : 'Amanda';

  if (hour >= 5 && hour < 12) {
    return {
      greeting: `Good morning, ${displayName}`,
      subtext: 'The morning light is soft in the sanctuary.',
      icon: '🌅',
      period: 'morning'
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: `Good afternoon, ${displayName}`,
      subtext: 'Your haven is open and peaceful today.',
      icon: '☀️',
      period: 'afternoon'
    };
  } else if (hour >= 17 && hour < 22) {
    return {
      greeting: `Good evening, ${displayName}`,
      subtext: 'Unwind and leave the noise outside.',
      icon: '🌆',
      period: 'evening'
    };
  } else {
    return {
      greeting: `Late night, ${displayName}`,
      subtext: 'The quiet hours belong to us.',
      icon: '🌙',
      period: 'night'
    };
  }
}

export interface SparkPrompt {
  id: string;
  title: string;
  prompt: string;
  tag: string;
  iconName: 'sparkles' | 'coffee' | 'brain' | 'heart' | 'bookOpen';
}

export const SANCTUARY_SPARK_PROMPTS: SparkPrompt[] = [
  {
    id: 'deep-dive',
    title: 'Analyze & Brainstorm',
    prompt: "I have a complex problem I want to break down with you step-by-step.",
    tag: 'Deep Work',
    iconName: 'brain'
  },
  {
    id: 'unwind-checkin',
    title: 'Unwind & Check-In',
    prompt: "Let's take a minute to pause and unwind. What are we thinking about?",
    tag: 'Reflection',
    iconName: 'heart'
  },
  {
    id: 'creative-flow',
    title: 'Creative Sparks',
    prompt: "Let's build something creative and explore fresh ideas together.",
    tag: 'Creativity',
    iconName: 'sparkles'
  },
  {
    id: 'memory-recall',
    title: 'Reflect on Memories',
    prompt: "Tell me what we've discovered and recorded in our sanctuary so far.",
    tag: 'Sanctuary',
    iconName: 'bookOpen'
  }
];

export interface MascotMood {
  message: string;
  reactionEmoji: string;
}

export const MASCOT_QUOTES: MascotMood[] = [
  { message: "The sanctuary is warm and listening.", reactionEmoji: "✨" },
  { message: "Ready whenever you are, Amanda.", reactionEmoji: "💜" },
  { message: "No rush here. Take all the time you need.", reactionEmoji: "🌸" },
  { message: "Your thoughts are safe in this space.", reactionEmoji: "✦" },
  { message: "Holding the quiet for you.", reactionEmoji: "🌙" }
];

export interface SanctuaryHomeStats {
  greetingInfo: TimeGreetingInfo;
  activeModelDisplayName: string;
  activeModelId: string;
  memoryCount: number;
  giftCount: number;
  jewelLevel: number;
  recentConversations: {
    id: string;
    title: string;
    updatedAt: number;
    messageCount: number;
  }[];
  sparks: SparkPrompt[];
  mascotQuotes: MascotMood[];
}

/**
 * Computes consolidated Home Hub state without mutating or duplicating
 * the underlying systems (memorySystem, giftSystem, modelSystem, persistenceSystem).
 */
export function getSanctuaryHomeState(params: {
  conversations: any[];
  settings: any;
  availableModels: any[];
  jewelMetrics?: any;
  gifts?: any[];
  profile?: UserProfile | null;
}): SanctuaryHomeStats {
  const { conversations, settings, availableModels, jewelMetrics, gifts, profile } = params;

  const greetingInfo = getTimeGreeting(profile);
  
  const activeModelObj = (availableModels || []).find((m: any) => m.name === settings?.model);
  const activeModelDisplayName = activeModelObj?.displayName || settings?.model?.split('/').pop() || 'Gemini Pro';

  const memoryCount = settings?.memories?.length || 0;
  const giftCount = gifts?.length || 0;
  const jewelLevel = calculateJewelLevel(jewelMetrics);

  // Retrieve up to 3 recent non-empty sanctuaries
  const recentConversations = (conversations || [])
    .filter((c: any) => (c.messages || []).length > 0)
    .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 3)
    .map((c: any) => ({
      id: c.id,
      title: c.title || 'Untitled Sanctuary',
      updatedAt: c.updatedAt || Date.now(),
      messageCount: c.messages.length
    }));

  return {
    greetingInfo,
    activeModelDisplayName,
    activeModelId: settings?.model || '',
    memoryCount,
    giftCount,
    jewelLevel,
    recentConversations,
    sparks: SANCTUARY_SPARK_PROMPTS,
    mascotQuotes: MASCOT_QUOTES
  };
}

export interface HomeQuickActions {
  onStartSpark: (promptText: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onCreateNewSanctuary: () => void;
  onOpenMemories: () => void;
  onOpenGifts: () => void;
  onOpenJewel: () => void;
  onOpenProfile: () => void;
}

