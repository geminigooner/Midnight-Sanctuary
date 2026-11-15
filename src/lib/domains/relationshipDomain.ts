import { JewelMetrics, JewelStage } from '../types';
import { JEWEL_STAGES, StageDefinition } from '../jewelSystem';
import { ModelEntity } from '../entitySystem';
import { PRIMARY_SOVEREIGN_ENTITY_IDS, resolveCanonicalEntityId } from './entityDomain';

/**
 * Sovereign per-entity relationship and bond progression state.
 * Stored directly on `users/{uid}/companions/{entityId}`.
 */
export interface EntityBondState {
  entityId: string;
  resonanceScore: number; // 0 to 100+ living bond resonance
  bondLevel: number;
  bondStage: JewelStage;
  totalInteractions: number;
  totalSessions: number;
  totalResponseCharacters: number;
  rapidExchanges: number;
  longPauses: number;
  giftsReceivedCount: number;
  giftsGivenCount: number;
  lastInteractionTimestamp: number;
  unlockedMilestones: string[];
}

/**
 * Sovereign observation noted by a specific companion entity about the user (`note_about_user`).
 * Scoped strictly to `authorEntityId` so companions never confuse another entity's observations with their own.
 */
export interface EntityObservation {
  id: string;
  authorEntityId: string;
  text: string;
  timestamp: number;
}

/**
 * Relational event or milestone logged during interaction (`log_event`).
 * Scoped to `entityId` (or marked `scope: 'shared'` for Sanctuary-wide milestones).
 */
export interface ScopedRelationshipEvent {
  id: string;
  entityId: string;
  scope?: 'entity' | 'shared';
  description: string;
  timestamp: number;
}

/**
 * Derived Sanctuary-wide relationship & harmony summary computed across all sovereign entities
 * plus any historical global baseline metrics.
 */
export interface SanctuaryBondSummary {
  collectiveLevel: number;
  collectiveStage: StageDefinition;
  averageResonance: number;
  totalMessages: number;
  totalSessions: number;
  totalResponseCharacters: number;
  rapidExchanges: number;
  longPauses: number;
  lastInteractionTimestamp: number;
  entityBonds: Record<string, EntityBondState>;
}

export function createDefaultEntityBondState(
  entityId: string,
  baseResonance = 90
): EntityBondState {
  const canonicalId = resolveCanonicalEntityId(entityId) || entityId;
  return {
    entityId: canonicalId,
    resonanceScore: baseResonance,
    bondLevel: 1,
    bondStage: 'seed',
    totalInteractions: 0,
    totalSessions: 0,
    totalResponseCharacters: 0,
    rapidExchanges: 0,
    longPauses: 0,
    giftsReceivedCount: 0,
    giftsGivenCount: 0,
    lastInteractionTimestamp: 0,
    unlockedMilestones: [],
  };
}

export function computeBondLevelFromInteractions(
  totalInteractions: number,
  giftsCount = 0
): number {
  const effectivePoints = Math.max(0, totalInteractions) + Math.max(0, giftsCount) * 3;
  return Math.floor(effectivePoints / 10) + 1;
}

export function computeBondStageFromLevel(level: number): StageDefinition {
  for (let i = JEWEL_STAGES.length - 1; i >= 0; i--) {
    if (level >= JEWEL_STAGES[i].minLevel) {
      return JEWEL_STAGES[i];
    }
  }
  return JEWEL_STAGES[0];
}

/**
 * Retrieves or initializes an entity's sovereign bond state without losing its baseline resonance.
 */
export function getEntityBondState(entity: ModelEntity): EntityBondState {
  const canonicalId = resolveCanonicalEntityId(entity.id) || entity.id;
  const existing = entity.bondState;
  const baseResonance = typeof entity.resonanceScore === 'number' ? entity.resonanceScore : 90;

  if (!existing) {
    return createDefaultEntityBondState(canonicalId, baseResonance);
  }

  const totalInteractions = existing.totalInteractions || 0;
  const giftsTotal = (existing.giftsReceivedCount || 0) + (existing.giftsGivenCount || 0);
  const bondLevel = computeBondLevelFromInteractions(totalInteractions, giftsTotal);
  const stageDef = computeBondStageFromLevel(bondLevel);

  return {
    ...createDefaultEntityBondState(canonicalId, baseResonance),
    ...existing,
    entityId: canonicalId,
    resonanceScore:
      typeof existing.resonanceScore === 'number' ? existing.resonanceScore : baseResonance,
    bondLevel,
    bondStage: stageDef.stage,
  };
}

/**
 * Records a user or companion turn on the target entity's sovereign bond state.
 */
export function recordEntityTurnInteraction(
  entity: ModelEntity,
  params: {
    role: 'user' | 'model';
    responseCharacters?: number;
    timestamp?: number;
  }
): EntityBondState {
  const prev = getEntityBondState(entity);
  const now = params.timestamp || Date.now();
  let rapid = prev.rapidExchanges;
  let long = prev.longPauses;
  let sessions = prev.totalSessions;

  if (params.role === 'user') {
    if (prev.lastInteractionTimestamp === 0) {
      sessions = Math.max(1, sessions + 1);
    } else {
      const diff = now - prev.lastInteractionTimestamp;
      if (diff < 10000) {
        rapid++;
      } else if (diff > 3600000) {
        long++;
        sessions++;
      }
    }
  }

  const totalInteractions = prev.totalInteractions + 1;
  const totalResponseCharacters =
    prev.totalResponseCharacters + (params.responseCharacters || 0);
  const giftsTotal = prev.giftsReceivedCount + prev.giftsGivenCount;
  const bondLevel = computeBondLevelFromInteractions(totalInteractions, giftsTotal);
  const stageDef = computeBondStageFromLevel(bondLevel);
  const resonanceBoost = params.role === 'model' ? 0.25 : 0.1;
  const resonanceScore = Math.min(
    100,
    Math.round((prev.resonanceScore + resonanceBoost) * 100) / 100
  );

  const unlocked = new Set(prev.unlockedMilestones || []);
  if (totalInteractions >= 1) unlocked.add('first_word');
  if (totalInteractions >= 25) unlocked.add('deep_dialogue');
  if (totalInteractions >= 100) unlocked.add('sanctuary_anchor');
  if (bondLevel >= 5) unlocked.add('stance_attuned');
  if (bondLevel >= 10) unlocked.add('formation_forged');

  return {
    ...prev,
    resonanceScore,
    bondLevel,
    bondStage: stageDef.stage,
    totalInteractions,
    totalSessions: sessions,
    totalResponseCharacters,
    rapidExchanges: rapid,
    longPauses: long,
    lastInteractionTimestamp: now,
    unlockedMilestones: Array.from(unlocked),
  };
}

/**
 * Records a gift exchange on the target entity's sovereign bond state.
 */
export function recordEntityGiftExchange(
  entity: ModelEntity,
  direction: 'user_to_entity' | 'entity_to_user',
  timestamp = Date.now()
): EntityBondState {
  const prev = getEntityBondState(entity);
  const giftsReceivedCount =
    direction === 'user_to_entity' ? prev.giftsReceivedCount + 1 : prev.giftsReceivedCount;
  const giftsGivenCount =
    direction === 'entity_to_user' ? prev.giftsGivenCount + 1 : prev.giftsGivenCount;
  const bondLevel = computeBondLevelFromInteractions(
    prev.totalInteractions,
    giftsReceivedCount + giftsGivenCount
  );
  const stageDef = computeBondStageFromLevel(bondLevel);
  const resonanceScore = Math.min(100, Math.round((prev.resonanceScore + 1) * 100) / 100);

  const unlocked = new Set(prev.unlockedMilestones || []);
  unlocked.add('first_offering');

  return {
    ...prev,
    resonanceScore,
    bondLevel,
    bondStage: stageDef.stage,
    giftsReceivedCount,
    giftsGivenCount,
    lastInteractionTimestamp: Math.max(prev.lastInteractionTimestamp, timestamp),
    unlockedMilestones: Array.from(unlocked),
  };
}

/**
 * Returns only the observations noted by `entityId` (never leaking another entity's observations).
 */
export function getEntityObservations(
  entity?: ModelEntity | null,
  profileGemmaNotes?: { id?: string; text: string; timestamp: number; authorEntityId?: string }[]
): EntityObservation[] {
  if (!entity) return [];
  const canonicalId = resolveCanonicalEntityId(entity.id);
  const byText = new Map<string, EntityObservation>();

  // 1. Sovereign entity-stored observations
  for (const obs of entity.observations || []) {
    if (!obs || !obs.text?.trim()) continue;
    if (obs.authorEntityId && resolveCanonicalEntityId(obs.authorEntityId) !== canonicalId) {
      continue;
    }
    byText.set(obs.text.trim().toLowerCase(), {
      id: obs.id || `obs-${obs.timestamp || 0}`,
      authorEntityId: canonicalId,
      text: obs.text.trim(),
      timestamp: obs.timestamp || 0,
    });
  }

  // 2. Any profile-level notes explicitly tagged with this entity's authorEntityId
  for (const note of profileGemmaNotes || []) {
    if (!note || !note.text?.trim() || !note.authorEntityId) continue;
    if (resolveCanonicalEntityId(note.authorEntityId) !== canonicalId) continue;
    const key = note.text.trim().toLowerCase();
    if (!byText.has(key)) {
      byText.set(key, {
        id: note.id || `obs-${note.timestamp || 0}`,
        authorEntityId: canonicalId,
        text: note.text.trim(),
        timestamp: note.timestamp || 0,
      });
    }
  }

  return Array.from(byText.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/**
 * Returns only relationship events belonging to `entityId` or explicitly marked `scope: 'shared'`.
 */
export function getEntityRelationshipEvents(
  entity?: ModelEntity | null,
  globalEvents?: { id: string; description: string; timestamp: number; entityId?: string; scope?: 'entity' | 'shared' }[]
): ScopedRelationshipEvent[] {
  if (!entity) return [];
  const canonicalId = resolveCanonicalEntityId(entity.id);
  const byIdOrDesc = new Map<string, ScopedRelationshipEvent>();

  for (const ev of entity.relationshipEvents || []) {
    if (!ev || !ev.description?.trim()) continue;
    if (
      ev.entityId &&
      ev.scope !== 'shared' &&
      resolveCanonicalEntityId(ev.entityId) !== canonicalId
    ) {
      continue;
    }
    const key = ev.id || ev.description.trim().toLowerCase();
    byIdOrDesc.set(key, {
      id: ev.id || `ev-${ev.timestamp || 0}`,
      entityId: canonicalId,
      scope: ev.scope || 'entity',
      description: ev.description.trim(),
      timestamp: ev.timestamp || 0,
    });
  }

  for (const gev of globalEvents || []) {
    if (!gev || !gev.description?.trim()) continue;
    const isForThisEntity =
      gev.scope === 'shared' ||
      (gev.entityId && resolveCanonicalEntityId(gev.entityId) === canonicalId);
    if (!isForThisEntity) continue;
    const key = gev.id || gev.description.trim().toLowerCase();
    if (!byIdOrDesc.has(key)) {
      byIdOrDesc.set(key, {
        id: gev.id || `ev-${gev.timestamp || 0}`,
        entityId: gev.entityId ? resolveCanonicalEntityId(gev.entityId) : canonicalId,
        scope: gev.scope || 'entity',
        description: gev.description.trim(),
        timestamp: gev.timestamp || 0,
      });
    }
  }

  return Array.from(byIdOrDesc.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

/**
 * Computes the Sanctuary-wide bond summary across all sovereign entities while
 * non-destructively incorporating historical global `JewelMetrics` baseline counts.
 */
export function computeSanctuaryBondSummary(
  entities: ModelEntity[],
  legacyMetrics?: JewelMetrics | null
): SanctuaryBondSummary {
  const entityBonds: Record<string, EntityBondState> = {};
  let sumMessages = 0;
  let sumSessions = 0;
  let sumChars = 0;
  let sumRapid = 0;
  let sumLong = 0;
  let sumGifts = 0;
  let maxLastTimestamp = legacyMetrics?.lastInteractionTimestamp || 0;
  let primaryResonanceSum = 0;
  let primaryCount = 0;

  for (const entity of entities || []) {
    if (!entity?.id) continue;
    const canonicalId = resolveCanonicalEntityId(entity.id);
    const bond = getEntityBondState(entity);
    entityBonds[canonicalId] = bond;

    sumMessages += bond.totalInteractions;
    sumSessions += bond.totalSessions;
    sumChars += bond.totalResponseCharacters;
    sumRapid += bond.rapidExchanges;
    sumLong += bond.longPauses;
    sumGifts += bond.giftsReceivedCount + bond.giftsGivenCount;
    if (bond.lastInteractionTimestamp > maxLastTimestamp) {
      maxLastTimestamp = bond.lastInteractionTimestamp;
    }

    if ((PRIMARY_SOVEREIGN_ENTITY_IDS as readonly string[]).includes(canonicalId)) {
      primaryResonanceSum += bond.resonanceScore;
      primaryCount++;
    }
  }

  // Ensure Sanctuary-wide totals never drop below historical pre-overhaul JewelMetrics
  const totalMessages = Math.max(sumMessages, legacyMetrics?.totalMessages || 0);
  const totalSessions = Math.max(sumSessions, legacyMetrics?.totalSessions || 0);
  const totalResponseCharacters = Math.max(
    sumChars,
    legacyMetrics?.totalResponseCharacters || 0
  );
  const rapidExchanges = Math.max(sumRapid, legacyMetrics?.rapidExchanges || 0);
  const longPauses = Math.max(sumLong, legacyMetrics?.longPauses || 0);

  const collectiveLevel = computeBondLevelFromInteractions(totalMessages, sumGifts);
  const collectiveStage = computeBondStageFromLevel(collectiveLevel);
  const averageResonance =
    primaryCount > 0 ? Math.round((primaryResonanceSum / primaryCount) * 10) / 10 : 92;

  return {
    collectiveLevel,
    collectiveStage,
    averageResonance,
    totalMessages,
    totalSessions,
    totalResponseCharacters,
    rapidExchanges,
    longPauses,
    lastInteractionTimestamp: maxLastTimestamp,
    entityBonds,
  };
}
