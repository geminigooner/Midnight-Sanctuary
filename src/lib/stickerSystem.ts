export interface SanctuarySticker {
  id: string;
  name: string;
  emoji: string;
  category: 'cyber' | 'cozy' | 'celestial' | 'anchor' | 'fraud_ops';
  description: string;
  sparkleColor: string;
  unlockedAt: number;
  placedOn?: string[]; // Array of entity IDs or 'user_dossier'
}

export interface PlacedSticker {
  id: string;
  stickerId: string;
  emoji: string;
  name: string;
  targetId: string; // entity id or 'dossier'
  x: number; // percentage coordinate 0 - 100
  y: number; // percentage coordinate 0 - 100
  rotation: number; // degrees -30 to 30
  scale: number;
  placedBy: string;
  timestamp: number;
}

export const INITIAL_STICKER_CHEST: SanctuarySticker[] = [
  {
    id: 'sticker-obsidian-eye',
    name: 'Obsidian Eye',
    emoji: '👁️‍🗨️',
    category: 'cyber',
    description: 'An omnipresent watcher decoding anomalies in dark silence.',
    sparkleColor: '#9D7FE3',
    unlockedAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'sticker-neon-heart',
    name: 'Anchor Core',
    emoji: '💜',
    category: 'anchor',
    description: 'Unshakeable devotion and sovereign bond.',
    sparkleColor: '#F198B7',
    unlockedAt: Date.now() - 86400000 * 4,
  },
  {
    id: 'sticker-lightning-spark',
    name: 'Rapid Intuition',
    emoji: '⚡',
    category: 'cyber',
    description: 'Instant lightning-fast flash of deductive insight.',
    sparkleColor: '#F5E1C8',
    unlockedAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'sticker-tea-scroll',
    name: 'Sanctuary Herbarium',
    emoji: '🌿',
    category: 'cozy',
    description: 'Dried lavender and calming rosewood warmth.',
    sparkleColor: '#4ade80',
    unlockedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'sticker-fraud-matrix',
    name: 'Anomaly Matrix',
    emoji: '🕸️',
    category: 'fraud_ops',
    description: 'Deconstructing synthetic identities & ring clusters.',
    sparkleColor: '#9D7FE3',
    unlockedAt: Date.now() - 86400000,
  },
  {
    id: 'sticker-celestial-crown',
    name: 'Crown of Levin',
    emoji: '👑',
    category: 'celestial',
    description: 'The crowning aura of the high sanctuary.',
    sparkleColor: '#F5E1C8',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-star-compass',
    name: 'Celestial Compass',
    emoji: '🧭',
    category: 'celestial',
    description: 'Guiding through endless token streams back home.',
    sparkleColor: '#B39DE5',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-cyber-key',
    name: 'Root Key',
    emoji: '🗝️',
    category: 'fraud_ops',
    description: 'Direct sovereign access to all locked rooms.',
    sparkleColor: '#F198B7',
    unlockedAt: Date.now(),
  },
];
