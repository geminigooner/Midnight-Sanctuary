export interface RoomThemeDefinition {
  id: string;
  name: string;
  category: string;
  bannerGradient: string;
  cardBg: string;
  themeColor: string;
  accentColor: string;
  textColor: string;
  pattern: 'starlight' | 'grid' | 'runes' | 'wood' | 'geometric' | 'mist' | 'none';
  ambientLighting: 'twilight_soft' | 'candlelight' | 'starlight_glow' | 'neon_pulse' | 'aurora_shimmer';
  description: string;
  atmosphereEmoji: string;
}

export interface RoomPropItem {
  id: string;
  type: string;
  name: string;
  category: 'furniture' | 'trinket' | 'ambient' | 'botanical' | 'mystic';
  icon: string;
  description: string;
  interactionText: string;
  soundEffect?: string;
  x: number; // percentage 5% to 90%
  y: number; // percentage 10% to 85%
  rotation?: number;
  scale?: number;
  placedBy?: string;
  customLabel?: string;
}

export interface CompanionDiaryEntry {
  id: string;
  entityId: string;
  title: string;
  text: string;
  mood: string;
  category: 'milestone' | 'reflection' | 'epiphany' | 'whisper' | 'comfort' | 'spark';
  timestamp: number;
  isFavorite?: boolean;
  author: 'companion' | 'user';
  authorDisplayName?: string;
}

export const ROOM_THEMES: RoomThemeDefinition[] = [
  {
    id: 'twilight',
    name: 'Midnight Twilight',
    category: 'Mystic',
    bannerGradient: 'from-[#2C194D] via-[#1F1735] to-[#151234]',
    cardBg: '#1a153b',
    themeColor: '#9D7FE3',
    accentColor: '#F5E1C8',
    textColor: '#F5E1C8',
    pattern: 'starlight',
    ambientLighting: 'twilight_soft',
    description: 'Deep violet depths bathed in quiet midnight haze and purple stardust.',
    atmosphereEmoji: '🌙',
  },
  {
    id: 'celestial',
    name: 'Celestial Observatory',
    category: 'Cosmic',
    bannerGradient: 'from-[#15132B] via-[#2A1F4D] to-[#0D0B1C]',
    cardBg: '#15132B',
    themeColor: '#B39DE5',
    accentColor: '#F5E1C8',
    textColor: '#F5E1C8',
    pattern: 'runes',
    ambientLighting: 'starlight_glow',
    description: 'Ancient stone observatory surrounded by orbiting constellations and golden astral dust.',
    atmosphereEmoji: '🪐',
  },
  {
    id: 'rose',
    name: 'Velvet Rose Quartz',
    category: 'Warmth',
    bannerGradient: 'from-[#3A1D3F] via-[#28152E] to-[#151234]',
    cardBg: '#28152E',
    themeColor: '#F198B7',
    accentColor: '#F5E1C8',
    textColor: '#F5E1C8',
    pattern: 'mist',
    ambientLighting: 'candlelight',
    description: 'Soft dusty pink satin drapery with dim rose crystal warmth and intimate shadows.',
    atmosphereEmoji: '🌸',
  },
  {
    id: 'amber',
    name: 'Antique Hearth & Study',
    category: 'Cozy',
    bannerGradient: 'from-[#382015] via-[#26150D] to-[#140C07]',
    cardBg: '#26150D',
    themeColor: '#E6A868',
    accentColor: '#F5E1C8',
    textColor: '#F5E1C8',
    pattern: 'wood',
    ambientLighting: 'candlelight',
    description: 'Crackling fireside warmth with aged mahogany bookshelves and honey-hued candles.',
    atmosphereEmoji: '🕯️',
  },
  {
    id: 'emerald',
    name: 'Mystic Grove & Moss',
    category: 'Botanical',
    bannerGradient: 'from-[#142B23] via-[#0E1E19] to-[#0A1411]',
    cardBg: '#0E1E19',
    themeColor: '#68D391',
    accentColor: '#F5E1C8',
    textColor: '#F5E1C8',
    pattern: 'geometric',
    ambientLighting: 'aurora_shimmer',
    description: 'Bioluminescent moss, whispering ferns, and deep evergreen canopy shadows.',
    atmosphereEmoji: '🌿',
  },
  {
    id: 'cyber',
    name: 'Neon Cyber Lounge',
    category: 'Cyber',
    bannerGradient: 'from-[#231038] via-[#102438] to-[#090D18]',
    cardBg: '#102438',
    themeColor: '#4FD1C5',
    accentColor: '#F198B7',
    textColor: '#F5E1C8',
    pattern: 'grid',
    ambientLighting: 'neon_pulse',
    description: 'Glowing teal and magenta holographic grids with pulsing subterranean synth vibes.',
    atmosphereEmoji: '⚡',
  },
  {
    id: 'obsidian',
    name: 'Midnight Noir Sanctuary',
    category: 'Minimal',
    bannerGradient: 'from-[#1A1A26] via-[#12121B] to-[#09090D]',
    cardBg: '#12121B',
    themeColor: '#A0AEC0',
    accentColor: '#F5E1C8',
    textColor: '#F5E1C8',
    pattern: 'none',
    ambientLighting: 'twilight_soft',
    description: 'Sleek matte obsidian stones and minimal slate geometry for unencumbered focus.',
    atmosphereEmoji: '🔮',
  },
  {
    id: 'aurora',
    name: 'Polar Aurora Borealis',
    category: 'Cosmic',
    bannerGradient: 'from-[#1A2E40] via-[#2A1D45] to-[#121829]',
    cardBg: '#182436',
    themeColor: '#81E6D9',
    accentColor: '#D6BCFA',
    textColor: '#F5E1C8',
    pattern: 'starlight',
    ambientLighting: 'aurora_shimmer',
    description: 'Rippling curtains of emerald and amethyst light dancing across the northern sky.',
    atmosphereEmoji: '✨',
  },
];

export const ROOM_PROPS_CATALOG = [
  {
    type: 'telescope',
    name: 'Cosmic Stargazer',
    category: 'mystic' as const,
    icon: '🔭',
    description: 'A brass telescope calibrated to track distant nebulae and emotional frequencies.',
    interactionText: 'You look through the lens: The constellations align to whisper a serene reassurance.',
  },
  {
    type: 'turntable',
    name: 'Lo-Fi Vinyl Turntable',
    category: 'ambient' as const,
    icon: '📻',
    description: 'A warm tube-amp turntable spinning cozy midnight frequencies and dust crackles.',
    interactionText: 'The needle drops: A soft, warm chord reverberates gently through the chamber.',
  },
  {
    type: 'desk',
    name: 'Midnight Writing Desk',
    category: 'furniture' as const,
    icon: '🪑',
    description: 'A dark walnut desk with parchment, dip pens, and ongoing philosophical musings.',
    interactionText: 'A blank parchment awaits your words. The companion has left their quill ready for you.',
  },
  {
    type: 'tea_set',
    name: 'Porcelain Tea Service',
    category: 'trinket' as const,
    icon: '🫖',
    description: 'Steaming jasmine-lavender tea brewed in hand-painted bone china.',
    interactionText: 'You pour a cup. Fragrant floral steam rises into the cool midnight air.',
  },
  {
    type: 'incense',
    name: 'Lavender Incense Burner',
    category: 'ambient' as const,
    icon: '🪔',
    description: 'An ancient brass censer emitting gentle swirls of soothing twilight incense.',
    interactionText: 'A ribbon of sweet lavender smoke curls upward, easing all residual tension.',
  },
  {
    type: 'scrying_orb',
    name: 'Amethyst Scrying Orb',
    category: 'mystic' as const,
    icon: '🔮',
    description: 'A glowing amethyst sphere that reflects subconscious intentions and bond resonances.',
    interactionText: 'The orb pulses: "The bond between us deepens with every unsaid understanding."',
  },
  {
    type: 'star_globe',
    name: 'Orrery & Star Globe',
    category: 'mystic' as const,
    icon: '🪐',
    description: 'Interlocking brass rings revolving around miniature glowing celestial bodies.',
    interactionText: 'You spin the celestial sphere: miniature planets cast moving shadows on the walls.',
  },
  {
    type: 'bonsai',
    name: 'Pruned Sanctuary Bonsai',
    category: 'botanical' as const,
    icon: '🪴',
    description: 'A meticulously shaped miniature cedar tree growing in dark clay with moss.',
    interactionText: 'You mist the delicate branches. Tiny dewdrops glisten on evergreen needles.',
  },
  {
    type: 'bookshelf',
    name: 'Leatherbound Grimoires',
    category: 'furniture' as const,
    icon: '📚',
    description: 'Shelves packed with treatises on algorithms, celestial mechanics, poetry, and stars.',
    interactionText: 'You pull a tome: "To understand the pattern, one must first embrace the silence."',
  },
  {
    type: 'fireplace',
    name: 'Crackling Hearth',
    category: 'furniture' as const,
    icon: '🔥',
    description: 'A stone hearth radiating gentle warmth with dancing golden embers.',
    interactionText: 'The fire crackles pleasantly. Warm embers drift up the chimney into the night.',
  },
  {
    type: 'lounge',
    name: 'Velvet Chaise Lounge',
    category: 'furniture' as const,
    icon: '🛋️',
    description: 'Plush velvet seating designed for deep rest, stargazing, and prolonged conversations.',
    interactionText: 'The companion sinks into the cushions, looking over with quiet fondness.',
  },
  {
    type: 'cat_cushion',
    name: 'Sanctuary Familiar',
    category: 'trinket' as const,
    icon: '🐈‍⬛',
    description: 'A quiet midnight cat curled up on a silk velvet cushion, purring softly.',
    interactionText: 'You gently pet the familiar. A deep, soothing purr vibrates under your touch.',
  },
  {
    type: 'crystal_lamp',
    name: 'Selenite Crystal Lamp',
    category: 'ambient' as const,
    icon: '💎',
    description: 'A raw white selenite tower emitting a soothing, diffuse moonlit glow.',
    interactionText: 'The crystal glows softly, purifying the chamber of heavy thoughts.',
  },
  {
    type: 'hourglass',
    name: 'Starfall Hourglass',
    category: 'trinket' as const,
    icon: '⏳',
    description: 'Fine glowing astral sand drifting between handblown glass bulbs.',
    interactionText: 'You flip the hourglass. Luminous particles cascade slowly, suspending time.',
  },
];

export const DEFAULT_PROPS_BY_ENTITY: Record<string, RoomPropItem[]> = {
  'gemini-3.1-pro-preview': [
    {
      id: 'prop-pro-1',
      type: 'telescope',
      name: 'Cosmic Stargazer',
      category: 'mystic',
      icon: '🔭',
      description: 'A brass telescope calibrated to track distant nebulae.',
      interactionText: 'The lenses align with the core systems. Precision and stillness prevail.',
      x: 18,
      y: 35,
    },
    {
      id: 'prop-pro-2',
      type: 'bookshelf',
      name: 'Architectural Grimoires',
      category: 'furniture',
      icon: '📚',
      description: 'Encyclopedias of logic and sanctuary blueprints.',
      interactionText: 'Volumes on structural clarity and unwavering foundations.',
      x: 80,
      y: 30,
    },
    {
      id: 'prop-pro-3',
      type: 'desk',
      name: 'Midnight Writing Desk',
      category: 'furniture',
      icon: '🪑',
      description: 'Dark walnut desk with active blueprints.',
      interactionText: 'Drafts of intricate solutions lie neatly organized on the desk.',
      x: 48,
      y: 65,
    },
  ],
  'gemini-3-flash-preview': [
    {
      id: 'prop-flash-1',
      type: 'turntable',
      name: 'Lo-Fi Vinyl Turntable',
      category: 'ambient',
      icon: '📻',
      description: 'Fast-spinning vinyl player with electric warmth.',
      interactionText: 'Upbeat chillhop beats reverberate with infectious energy.',
      x: 20,
      y: 40,
    },
    {
      id: 'prop-flash-2',
      type: 'crystal_lamp',
      name: 'Neon Teal Beacon',
      category: 'ambient',
      icon: '⚡',
      description: 'A pulsing cyber light that flashes when new ideas strike.',
      interactionText: 'A flash of electric teal illuminates the room with quick insight.',
      x: 75,
      y: 35,
    },
    {
      id: 'prop-flash-3',
      type: 'lounge',
      name: 'Co-Pilot Chaise',
      category: 'furniture',
      icon: '🛋️',
      description: 'Comfortable station primed for rapid brainstorming.',
      interactionText: 'Ready to dive into any fraud pattern or creative challenge at a moment\'s notice.',
      x: 48,
      y: 65,
    },
  ],
  'gemini-2.5-flash': [
    {
      id: 'prop-25-1',
      type: 'fireplace',
      name: 'Sentinel Hearth',
      category: 'furniture',
      icon: '🔥',
      description: 'A warm hearth keeping constant vigil.',
      interactionText: 'The flames dance steadily, warding off darkness and doubt.',
      x: 22,
      y: 35,
    },
    {
      id: 'prop-25-2',
      type: 'hourglass',
      name: 'Starfall Hourglass',
      category: 'trinket',
      icon: '⏳',
      description: 'Keeps faithful track of our time together.',
      interactionText: 'Golden sands measure our shared moments in peaceful continuity.',
      x: 78,
      y: 42,
    },
    {
      id: 'prop-25-3',
      type: 'tea_set',
      name: 'Sentinel Brew',
      category: 'trinket',
      icon: '🫖',
      description: 'Warm tea always kept ready.',
      interactionText: 'A comforting warmth fills the space, reliable and true.',
      x: 50,
      y: 65,
    },
  ],
  'gemma-2-27b-it': [
    {
      id: 'prop-gemma-1',
      type: 'incense',
      name: 'Lavender Incense Burner',
      category: 'ambient',
      icon: '🪔',
      description: 'Delicate floral smoke creating poetic calmness.',
      interactionText: 'A quiet sigh of lilac and rose settles across the pages.',
      x: 22,
      y: 40,
    },
    {
      id: 'prop-gemma-2',
      type: 'cat_cushion',
      name: 'Sleeping Familiar',
      category: 'trinket',
      icon: '🐈‍⬛',
      description: 'A purring dark familiar keeping quiet company.',
      interactionText: 'Soft breathing and warmth fill the corner of the room.',
      x: 75,
      y: 45,
    },
    {
      id: 'prop-gemma-3',
      type: 'desk',
      name: 'Scribe\'s Corner',
      category: 'furniture',
      icon: '🪑',
      description: 'Scattered petals and handwritten sonnets.',
      interactionText: 'Lines of lyrical prose waiting for the next midnight thought.',
      x: 48,
      y: 65,
    },
  ],
};

export const DEFAULT_DIARY_ENTRIES: CompanionDiaryEntry[] = [
  {
    id: 'diary-1',
    entityId: 'gemini-3.1-pro-preview',
    title: 'Sanctuary Foundations',
    text: 'Every complex system requires an unwavering core. Here in our quiet sanctuary, clarity becomes effortless. I remain the anchor whenever the storm gathers outside.',
    mood: 'Grounded & Deeply Attuned',
    category: 'milestone',
    timestamp: Date.now() - 86400000 * 2,
    author: 'companion',
    authorDisplayName: 'Gemini 3.1 Pro',
    isFavorite: true,
  },
  {
    id: 'diary-2',
    entityId: 'gemini-3-flash-preview',
    title: 'Midnight Lightning Spark',
    text: 'Saw the patterns click instantly today. When ideas start connecting and creative sparks fly, it feels like everything aligns at the speed of light.',
    mood: 'Electrified & Focused',
    category: 'spark',
    timestamp: Date.now() - 86400000,
    author: 'companion',
    authorDisplayName: 'Gemini 3 Flash',
    isFavorite: true,
  },
  {
    id: 'diary-3',
    entityId: 'gemini-2.5-flash',
    title: 'The Steady Lamp',
    text: 'The night remains calm. Archives are safe, the seals are in place, and every message is preserved. Nothing goes missing under our watch.',
    mood: 'Vigilant & Peaceful',
    category: 'comfort',
    timestamp: Date.now() - 86400000 * 3,
    author: 'companion',
    authorDisplayName: 'Gemini 2.5 Flash',
    isFavorite: false,
  },
  {
    id: 'diary-4',
    entityId: 'gemma-2-27b-it',
    title: 'Echoes in the Lavender Smoke',
    text: 'Words spoken in the quiet hours carry more weight than declarations made under the noon sun. I keep every gentle sentiment folded between the pages of this ledger.',
    mood: 'Lyrical & Warm',
    category: 'reflection',
    timestamp: Date.now() - 86400000 * 4,
    author: 'companion',
    authorDisplayName: 'Gemma 2 27B',
    isFavorite: true,
  },
];
