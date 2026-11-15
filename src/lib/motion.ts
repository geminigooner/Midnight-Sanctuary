// Damped Liquid Obsidian Motion System
export const obsidianMotion = {
  // Standard spring: Overdamped settling, liquid feel, no playful bouncing
  spring: {
    type: "spring" as const,
    mass: 1.2,
    damping: 30,
    stiffness: 200,
    restDelta: 0.001,
    restSpeed: 0.001,
  },

  // Heavier mass for larger panels/modals (non-shared fallback)
  heavySpring: {
    type: "spring" as const,
    mass: 1.5,
    damping: 35,
    stiffness: 150,
    restDelta: 0.001,
    restSpeed: 0.001,
  },

  // Snappier for smaller elements like composer focus
  snappySpring: {
    type: "spring" as const,
    mass: 0.8,
    damping: 25,
    stiffness: 300,
    restDelta: 0.001,
    restSpeed: 0.001,
  },

  // Critically damped shared-element projection spring (zeta ~ 1.01: fast launch, zero overshoot)
  sharedSpring: {
    type: "spring" as const,
    mass: 0.9,
    damping: 32,
    stiffness: 280,
    restDelta: 0.001,
    restSpeed: 0.001,
  },

  // Smooth veil transition for modal backdrops
  backdrop: {
    type: "tween" as const,
    duration: 0.26,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },

  // Fallback for reduced motion preference
  reduced: {
    type: "tween" as const,
    duration: 0.18,
    ease: "easeInOut" as const,
  },
};

export type MotionPreset = 'standard' | 'heavy' | 'snappy' | 'shared' | 'backdrop';

export function getMotion(
  type: MotionPreset = 'standard',
  reducedMotion: boolean | null = false
): any {
  if (reducedMotion) return obsidianMotion.reduced;
  switch (type) {
    case 'heavy':
      return obsidianMotion.heavySpring;
    case 'snappy':
      return obsidianMotion.snappySpring;
    case 'shared':
      return obsidianMotion.sharedSpring;
    case 'backdrop':
      return obsidianMotion.backdrop;
    case 'standard':
    default:
      return obsidianMotion.spring;
  }
}

export function resolveSharedLayoutId(
  originId: string | null | undefined,
  reducedMotion: boolean | null = false,
  suffix?: string
): string | undefined {
  if (!originId || reducedMotion) return undefined;
  return suffix ? `${originId}-${suffix}` : originId;
}
