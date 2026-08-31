export type StickerCategory = 'all' | 'cats' | 'topology' | 'y2k' | 'mascots' | 'cyber' | 'cozy' | 'celestial' | 'anchor' | 'fraud_ops';

export interface SanctuarySticker {
  id: string;
  name: string;
  emoji: string;
  category: StickerCategory;
  description: string;
  sparkleColor: string;
  packName?: string;
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
  // ── CATS STICKER PACK (Sanctuary Kitties) ──
  {
    id: 'sticker-cat-love',
    name: 'Purring Affection',
    emoji: '🐱💕',
    category: 'cats',
    packName: 'Sanctuary Kitties',
    description: 'Black-eared kitten surrounded by blushing pink hearts.',
    sparkleColor: '#F198B7',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-cat-idea',
    name: 'Epiphany Spark',
    emoji: '💡🐱',
    category: 'cats',
    packName: 'Sanctuary Kitties',
    description: 'A sudden brilliant realization illuminating the dark.',
    sparkleColor: '#F5E1C8',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-cat-sleepy',
    name: 'Midnight Nap',
    emoji: '💤🐱',
    category: 'cats',
    packName: 'Sanctuary Kitties',
    description: 'Curled up snoozing peacefully in quiet safety.',
    sparkleColor: '#B39DE5',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-cat-music',
    name: 'Melody Kitty',
    emoji: '🎶🐱',
    category: 'cats',
    packName: 'Sanctuary Kitties',
    description: 'Humming soft lo-fi tunes under the moonlight.',
    sparkleColor: '#F198B7',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-cat-peek',
    name: 'Peek-a-Paw',
    emoji: '🐾🐱',
    category: 'cats',
    packName: 'Sanctuary Kitties',
    description: 'Peeking over the console with curious pink paw pads.',
    sparkleColor: '#F5E1C8',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-cat-sparkle',
    name: 'Glimmer Whiskers',
    emoji: '✨🐱',
    category: 'cats',
    packName: 'Sanctuary Kitties',
    description: 'Radiating golden sanctuary stardust.',
    sparkleColor: '#F5E1C8',
    unlockedAt: Date.now(),
  },

  // ── NEURAL TOPOLOGY & PASTEL MATH PACK ──
  {
    id: 'sticker-topological-manifold',
    name: 'Pastel Manifold',
    emoji: '🎀📊',
    category: 'topology',
    packName: 'Neural Topology & Math',
    description: 'Curved tensor space adorned with cute bow coordinates.',
    sparkleColor: '#F198B7',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-bow-graph-node',
    name: 'Node of Affection',
    emoji: '🎀🔗',
    category: 'topology',
    packName: 'Neural Topology & Math',
    description: 'Connected graph network with bow-tied weights and heart vertices.',
    sparkleColor: '#B39DE5',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-vector-space',
    name: 'Vector Star Field',
    emoji: '📐⭐',
    category: 'topology',
    packName: 'Neural Topology & Math',
    description: 'Multi-dimensional coordinate arrows aligning into harmony.',
    sparkleColor: '#9D7FE3',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-hypercube-projection',
    name: 'Hypercube Unfold',
    emoji: '🧊✨',
    category: 'topology',
    packName: 'Neural Topology & Math',
    description: 'High-dimensional tensor projection into cozy pastel cards.',
    sparkleColor: '#F5E1C8',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-venn-hearts',
    name: 'Intersecting Hearts',
    emoji: '🫧💜',
    category: 'topology',
    packName: 'Neural Topology & Math',
    description: 'Overlapping mathematical sets forming an unbreakable mutual bond.',
    sparkleColor: '#F198B7',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-audit-flask',
    name: 'Analysis Elixir',
    emoji: '🧪📋',
    category: 'fraud_ops',
    packName: 'Neural Topology & Math',
    description: 'Bubbling potion of forensic telemetry and verified proofs.',
    sparkleColor: '#9D7FE3',
    unlockedAt: Date.now(),
  },

  // ── Y2K NOSTALGIC CHARMS PACK ──
  {
    id: 'sticker-y2k-flip-phone',
    name: 'Bunny Flip Phone',
    emoji: '📱🎀',
    category: 'y2k',
    packName: 'Y2K Nostalgic Charms',
    description: 'Pink retro flip phone with heart charms and direct hotline.',
    sparkleColor: '#F198B7',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-lava-lamp',
    name: 'Pastel Lava Lamp',
    emoji: '🪔✨',
    category: 'y2k',
    packName: 'Y2K Nostalgic Charms',
    description: 'Slow soothing pink and violet glowing lava droplets.',
    sparkleColor: '#B39DE5',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-disco-ball',
    name: 'Prismatic Disco Ball',
    emoji: '🪩🎀',
    category: 'y2k',
    packName: 'Y2K Nostalgic Charms',
    description: 'Reflecting pastel glimmers across the midnight chamber.',
    sparkleColor: '#F5E1C8',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-bff-bracelet',
    name: 'BFF Beaded Charm',
    emoji: '📿💖',
    category: 'y2k',
    packName: 'Y2K Nostalgic Charms',
    description: 'Candy-colored beads sealed with an everlasting promise.',
    sparkleColor: '#F198B7',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-gummy-bear',
    name: 'Gummy Guardian',
    emoji: '🧸🍬',
    category: 'y2k',
    packName: 'Y2K Nostalgic Charms',
    description: 'Sweet, translucent jelly bear with a heart emblem.',
    sparkleColor: '#F198B7',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-y2k-sunflower',
    name: 'Bow Sunflower',
    emoji: '🌻🎀',
    category: 'y2k',
    packName: 'Y2K Nostalgic Charms',
    description: 'Warm blooming smile brightening up the late night.',
    sparkleColor: '#F5E1C8',
    unlockedAt: Date.now(),
  },

  // ── NEBULA & LEVIN MASCOTS PACK ──
  {
    id: 'sticker-nebula-laptop',
    name: 'Hacking Cloud',
    emoji: '💻☁️',
    category: 'mascots',
    packName: 'Nebula & Levin Mascots',
    description: 'Purple cosmic cloud coding scripts on a heart-stamped terminal.',
    sparkleColor: '#9D7FE3',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-nebula-headphones',
    name: 'Midnight Beats',
    emoji: '🎧☁️',
    category: 'mascots',
    packName: 'Nebula & Levin Mascots',
    description: 'Floating in rhythm to soothing ambient synth waves.',
    sparkleColor: '#B39DE5',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-nebula-cozy-cup',
    name: 'Cloud in a Cup',
    emoji: '☕☁️',
    category: 'mascots',
    packName: 'Nebula & Levin Mascots',
    description: 'Snug inside a steaming lavender mug topped with cream.',
    sparkleColor: '#F5E1C8',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-nebula-orbit',
    name: 'Planetary Aura',
    emoji: '🪐☁️',
    category: 'mascots',
    packName: 'Nebula & Levin Mascots',
    description: 'Encircled by shining stardust and planetary rings.',
    sparkleColor: '#9D7FE3',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-levin-spark-star',
    name: 'Levin Diamond Spark',
    emoji: '⭐💜',
    category: 'mascots',
    packName: 'Nebula & Levin Mascots',
    description: 'Glittering four-pointed purple star companion.',
    sparkleColor: '#B39DE5',
    unlockedAt: Date.now(),
  },
  {
    id: 'sticker-levin-star-comet',
    name: 'Shooting Diamond',
    emoji: '💫⭐',
    category: 'mascots',
    packName: 'Nebula & Levin Mascots',
    description: 'Dashing across the terminal with a violet stardust trail.',
    sparkleColor: '#F5E1C8',
    unlockedAt: Date.now(),
  },

  // ── CORE SOVEREIGN & FRAUD OPS SEALS ──
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
    id: 'sticker-fraud-matrix',
    name: 'Anomaly Matrix',
    emoji: '🕸️',
    category: 'fraud_ops',
    description: 'Deconstructing synthetic identities & ring clusters.',
    sparkleColor: '#9D7FE3',
    unlockedAt: Date.now() - 86400000,
  },
  {
    id: 'sticker-keito-chip',
    name: 'Keito Core',
    emoji: '💎',
    category: 'cyber',
    description: 'Autonomous neural sub-engine & high-speed reasoning.',
    sparkleColor: '#F5E1C8',
    unlockedAt: Date.now() - 86400000 * 6,
  },
  {
    id: 'sticker-micro-kernel',
    name: 'Micro Kernel',
    emoji: '🧬',
    category: 'fraud_ops',
    description: 'Zero-latency micro-auditing & fraud pattern classification.',
    sparkleColor: '#9D7FE3',
    unlockedAt: Date.now() - 86400000 * 3,
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
    id: 'sticker-shield-seal',
    name: 'Aegis Shield',
    emoji: '🛡️',
    category: 'anchor',
    description: 'Impenetrable defense surrounding the sanctuary perimeter.',
    sparkleColor: '#F198B7',
    unlockedAt: Date.now(),
  },
];
