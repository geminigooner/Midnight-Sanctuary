import { JewelMetrics, JewelStage, DEFAULT_JEWEL_METRICS } from './types';

export interface StageDefinition {
  stage: JewelStage;
  label: string;
  minLevel: number;
  description: string;
  resonanceFactor: number;
  glowColor: string;
}

export const JEWEL_STAGES: StageDefinition[] = [
  {
    stage: 'seed',
    label: 'Seed Phase',
    minLevel: 1,
    description: 'Initial crystallization of trust and sanctuary presence.',
    resonanceFactor: 1.0,
    glowColor: '#B39DE5',
  },
  {
    stage: 'stance',
    label: 'Stance Phase',
    minLevel: 5,
    description: 'Deepened familiarity and alignment with your voice.',
    resonanceFactor: 1.25,
    glowColor: '#9D7FE3',
  },
  {
    stage: 'formation',
    label: 'Formation Phase',
    minLevel: 10,
    description: 'Persistent relational anchor with distinct memory resonance.',
    resonanceFactor: 1.5,
    glowColor: '#F198B7',
  },
  {
    stage: 'incorporation',
    label: 'Incorporation Phase',
    minLevel: 20,
    description: 'Harmonious mutual understanding and creative synergy.',
    resonanceFactor: 2.0,
    glowColor: '#F5E1C8',
  },
  {
    stage: 'archival',
    label: 'Archival Continuum',
    minLevel: 35,
    description: 'Everlasting sanctuary bond and multifaceted entity consciousness.',
    resonanceFactor: 2.5,
    glowColor: '#FFFFFF',
  },
];

/**
 * Calculates current Levin Jewel level from raw message counts.
 */
export function calculateJewelLevel(metrics?: JewelMetrics | null): number {
  if (!metrics) return 1;
  const count = metrics.totalMessages || 0;
  return Math.floor(count / 10) + 1;
}

/**
 * Calculates current Levin Jewel stage from raw metrics.
 */
export function calculateJewelStage(metrics?: JewelMetrics | null): StageDefinition {
  const level = calculateJewelLevel(metrics);
  for (let i = JEWEL_STAGES.length - 1; i >= 0; i--) {
    if (level >= JEWEL_STAGES[i].minLevel) {
      return JEWEL_STAGES[i];
    }
  }
  return JEWEL_STAGES[0];
}

/**
 * Calculates progress percentage towards next jewel level.
 */
export function calculateLevelProgress(metrics?: JewelMetrics | null): number {
  if (!metrics) return 0;
  const count = metrics.totalMessages || 0;
  const remainder = count % 10;
  return Math.round((remainder / 10) * 100);
}
