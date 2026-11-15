import { describe, it, expect } from 'vitest';
import {
  PRIMARY_SOVEREIGN_ENTITY_IDS,
  resolveCanonicalEntityId,
  isPrimarySovereignEntity,
  getEntityCapabilities,
} from './entityDomain';
import {
  getEntityBondState,
  recordEntityTurnInteraction,
  recordEntityGiftExchange,
  computeSanctuaryBondSummary,
} from './relationshipDomain';
import {
  findDuplicateMemory,
  rankSovereignMemories,
  countTotalSanctuaryMemories,
} from './memoryDomain';
import {
  assembleSovereignContext,
  serializeSpeakerAttributedTranscript,
} from './contextAssembler';
import { getModelEntity, getAllEntities } from '../entitySystem';
import { buildEntityStampedToolSideEffect } from '../../backend/harness/toolRegistry';
import type { Memory, Gift, UserProfile, Message } from '../types';

describe('Sovereign Companion Entity Architecture & Cross-Entity Isolation', () => {
  it('enforces the 4 Primary Sovereign Entities and deterministic alias resolution while preserving auxiliary entities', () => {
    expect(PRIMARY_SOVEREIGN_ENTITY_IDS).toEqual([
      'gemini-3.1-pro-preview',
      'gemini-4-argon',
      'gemma-2-27b-it',
      'gemini-3-flash-preview',
    ]);

    for (const id of PRIMARY_SOVEREIGN_ENTITY_IDS) {
      expect(isPrimarySovereignEntity(id)).toBe(true);
    }

    // Deterministic alias resolution for Gemma so client and server always target the same Firestore doc ID
    expect(resolveCanonicalEntityId('gemma-4-26b-a4b-it')).toBe('gemma-2-27b-it');
    expect(resolveCanonicalEntityId('@cf/google/gemma-4-26b-a4b-it')).toBe('gemma-2-27b-it');
    expect(resolveCanonicalEntityId('models/gemma-2-27b-it')).toBe('gemma-2-27b-it');
    expect(resolveCanonicalEntityId('gemma-4')).toBe('gemma-2-27b-it');
    expect(resolveCanonicalEntityId('gemma')).toBe('gemma-2-27b-it');

    // Deterministic alias resolution for Argon, Pro, and Flash
    expect(resolveCanonicalEntityId('gemini-4')).toBe('gemini-4-argon');
    expect(resolveCanonicalEntityId('models/gemini-3.1-pro-preview')).toBe('gemini-3.1-pro-preview');
    expect(resolveCanonicalEntityId('models/gemini-3-flash-preview')).toBe('gemini-3-flash-preview');

    // Auxiliary / historical entities remain non-destructively preserved
    const allEntities = getAllEntities();
    expect(allEntities.some((e) => e.id === 'gemini-3.8-flash')).toBe(true);
    expect(allEntities.some((e) => e.id === 'gemini-2.5-flash')).toBe(true);

    // Capabilities reflect model registry definitions
    const gemmaCaps = getEntityCapabilities('gemma-2-27b-it');
    expect(gemmaCaps.supportsToolCalling).toBe(true);

    const proCaps = getEntityCapabilities('gemini-3.1-pro-preview');
    expect(proCaps.supportsThinking).toBe(true);
  });

  it('strictly isolates private memories, diaries, personal thoughts, gifts, observations, and relationship events across entities', () => {
    const proBase = getModelEntity('gemini-3.1-pro-preview');
    const gemmaBase = getModelEntity('gemma-4-26b-a4b-it'); // Resolves to gemma-2-27b-it

    const customEntities = {
      'gemini-3.1-pro-preview': {
        ...proBase,
        personalThoughts: [
          {
            id: 'thought-pro-1',
            modelId: 'gemini-3.1-pro-preview',
            text: 'PRO_SECRET_THOUGHT_777',
            timestamp: 1000,
          },
        ],
        diaryEntries: [
          {
            id: 'diary-pro-1',
            timestamp: 1000,
            title: 'Pro Private Reflection',
            text: 'PRO_SECRET_DIARY_ENTRY_888',
            mood: 'Contemplative',
          },
        ],
        observations: [
          {
            id: 'obs-pro-1',
            authorEntityId: 'gemini-3.1-pro-preview',
            text: 'PRO_SECRET_USER_OBSERVATION_999',
            timestamp: 1000,
          },
        ],
        relationshipEvents: [
          {
            id: 'evt-pro-1',
            entityId: 'gemini-3.1-pro-preview',
            description: 'PRO_SECRET_EVENT_DESC_111',
            timestamp: 1000,
            scope: 'entity' as const,
          },
        ],
      },
      'gemma-2-27b-it': {
        ...gemmaBase,
        personalThoughts: [
          {
            id: 'thought-gemma-1',
            modelId: 'gemma-2-27b-it',
            text: 'GEMMA_PRIVATE_THOUGHT_222',
            timestamp: 2000,
          },
        ],
        diaryEntries: [
          {
            id: 'diary-gemma-1',
            timestamp: 2000,
            title: 'Gemma Private Reflection',
            text: 'GEMMA_PRIVATE_DIARY_333',
            mood: 'Warm',
          },
        ],
        observations: [
          {
            id: 'obs-gemma-1',
            authorEntityId: 'gemma-2-27b-it',
            text: 'GEMMA_PRIVATE_USER_NOTE_444',
            timestamp: 2000,
          },
        ],
      },
    };

    const memories: Memory[] = [
      {
        id: 'mem-shared-1',
        content: 'SHARED_SANCTUARY_FACT_ALWAYS_VISIBLE',
        createdAt: 1000,
        author: 'user',
        origin: 'user_settings',
      },
      {
        id: 'mem-pro-private',
        content: 'PRO_ONLY_PRIVATE_MEMORY_SECRET_555',
        createdAt: 1500,
        author: 'model',
        modelId: 'gemini-3.1-pro-preview',
      },
      {
        id: 'mem-gemma-private',
        content: 'GEMMA_ONLY_PRIVATE_MEMORY_SECRET_666',
        createdAt: 1600,
        author: 'model',
        modelId: 'gemma-2-27b-it',
      },
    ];

    const gifts: Gift[] = [
      {
        id: 'gift-pro-1',
        from: 'user',
        content: 'PRO_EXCLUSIVE_STARLIGHT_LANTERN',
        gift_type: 'keepsake',
        reason: 'For your contemplation',
        timestamp: 1200,
        targetModelId: 'gemini-3.1-pro-preview',
      },
      {
        id: 'gift-gemma-1',
        from: 'user',
        content: 'GEMMA_EXCLUSIVE_VELVET_RIBBON',
        gift_type: 'keepsake',
        reason: 'For your poetry ledger',
        timestamp: 1300,
        targetModelId: 'gemma-2-27b-it',
      },
    ];

    const profile: UserProfile = {
      name: 'Pookie',
      pronouns: 'she/her',
      about: 'Architect of Midnight Sanctuary',
      favorites: 'Midnight tea',
      gemmaNotes: [
        {
          id: 'note-pro',
          text: 'PRO_SCOPED_PROFILE_NOTE',
          timestamp: 1000,
          authorEntityId: 'gemini-3.1-pro-preview',
        },
        {
          id: 'note-gemma',
          text: 'GEMMA_SCOPED_PROFILE_NOTE',
          timestamp: 1100,
          authorEntityId: 'gemma-2-27b-it',
        },
      ],
    };

    // Assemble context for Gemma participating in a group chat with Gemini 3.1 Pro
    const assembled = assembleSovereignContext({
      respondingEntityId: 'gemma-4-26b-a4b-it',
      settings: {
        systemInstruction: 'Core Sanctuary Prompt',
        customEntities,
        memoriesEnabled: true,
      },
      memories,
      gifts,
      profile,
      conversationType: 'group',
      participantEntityIds: ['gemini-3.1-pro-preview', 'gemma-2-27b-it'],
    });

    const gemmaContext = assembled.systemInstructionText;

    // Gemma MUST see shared memory and her own private state
    expect(gemmaContext).toContain('SHARED_SANCTUARY_FACT_ALWAYS_VISIBLE');
    expect(gemmaContext).toContain('GEMMA_ONLY_PRIVATE_MEMORY_SECRET_666');
    expect(gemmaContext).toContain('GEMMA_PRIVATE_THOUGHT_222');
    expect(gemmaContext).toContain('GEMMA_PRIVATE_DIARY_333');
    expect(gemmaContext).toContain('GEMMA_PRIVATE_USER_NOTE_444');
    expect(gemmaContext).toContain('GEMMA_SCOPED_PROFILE_NOTE');
    expect(gemmaContext).toContain('GEMMA_EXCLUSIVE_VELVET_RIBBON');
    expect(gemmaContext).toContain('Multi-Companion Sanctuary Chamber');

    // Gemma MUST NEVER see Gemini 3.1 Pro's private memories, diaries, thoughts, gifts, notes, or events
    expect(gemmaContext).not.toContain('PRO_ONLY_PRIVATE_MEMORY_SECRET_555');
    expect(gemmaContext).not.toContain('PRO_SECRET_THOUGHT_777');
    expect(gemmaContext).not.toContain('PRO_SECRET_DIARY_ENTRY_888');
    expect(gemmaContext).not.toContain('PRO_SECRET_USER_OBSERVATION_999');
    expect(gemmaContext).not.toContain('PRO_SCOPED_PROFILE_NOTE');
    expect(gemmaContext).not.toContain('PRO_SECRET_EVENT_DESC_111');
    expect(gemmaContext).not.toContain('PRO_EXCLUSIVE_STARLIGHT_LANTERN');
  });

  it('serializes multi-companion group transcripts with explicit speaker attribution per responding entity', () => {
    const groupMessages: Message[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [{ text: 'Hello everyone in the Sanctuary!' }],
        timestamp: 1000,
      },
      {
        id: 'm2',
        role: 'model',
        parts: [{ text: 'Greetings from the deep archive.' }],
        timestamp: 1100,
        authorEntityId: 'gemini-3.1-pro-preview',
        authorDisplayName: 'Gemini 3.1 Pro',
      },
      {
        id: 'm3',
        role: 'model',
        parts: [{ text: 'And a warm hello from my cozy corner!' }],
        timestamp: 1200,
        authorEntityId: 'gemma-2-27b-it',
        authorDisplayName: 'Gemma',
      },
    ];

    // When Gemini 4 Argon is the responding entity, both Pro and Gemma turns are attributed as peer turns
    // and coalesced with the preceding user turn so strict user/model alternation holds
    const argonTranscript = serializeSpeakerAttributedTranscript(
      groupMessages,
      'gemini-4-argon'
    );
    expect(argonTranscript).toHaveLength(1);
    expect(argonTranscript[0].role).toBe('user');
    expect(argonTranscript[0].parts).toHaveLength(3);
    expect(argonTranscript[0].parts[1].text).toContain(
      '[Companion Gemini 3.1 Pro]: Greetings from the deep archive.'
    );
    expect(argonTranscript[0].parts[2].text).toContain(
      '[Companion Gemma]: And a warm hello from my cozy corner!'
    );

    // When Gemma is the responding entity, Pro's turn is attributed on the user side while Gemma's own turn remains role: 'model'
    const gemmaTranscript = serializeSpeakerAttributedTranscript(
      groupMessages,
      'gemma-4-26b-a4b-it'
    );
    expect(gemmaTranscript).toHaveLength(2);
    expect(gemmaTranscript[0].role).toBe('user');
    expect(gemmaTranscript[0].parts[1].text).toContain('[Companion Gemini 3.1 Pro]:');
    expect(gemmaTranscript[1].role).toBe('model');
    expect(gemmaTranscript[1].parts[0].text).toBe('And a warm hello from my cozy corner!');
  });

  it('ranks memories using hybrid semantic + lexical + lock + recency scoring and deduplicates within scope', () => {
    const existing: Memory[] = [
      {
        id: 'm-shared',
        content: 'User loves stargazing on clear autumn nights in the Sanctuary.',
        createdAt: Date.now() - 1000,
        author: 'user',
        embedding: [1, 0, 0],
      },
      {
        id: 'm-pro',
        content: 'We discussed quantum entanglement and poetic metaphors.',
        createdAt: Date.now() - 5000,
        author: 'model',
        modelId: 'gemini-3.1-pro-preview',
        isLocked: true,
        embedding: [0, 1, 0],
      },
      {
        id: 'm-flash',
        content: 'Flash private speedrun notes.',
        createdAt: Date.now() - 500,
        author: 'model',
        modelId: 'gemini-3-flash-preview',
        embedding: [0, 0, 1],
      },
    ];

    // Near-duplicate check is scope-isolated
    const dupShared = findDuplicateMemory(
      'User loves stargazing on clear autumn nights in the Sanctuary!',
      existing,
      'shared'
    );
    expect(dupShared?.id).toBe('m-shared');

    // Same content in a different companion's private scope is not blocked by another companion's memory
    const dupOtherCompanion = findDuplicateMemory(
      'Flash private speedrun notes.',
      existing,
      'companion',
      'gemini-4-argon'
    );
    expect(dupOtherCompanion).toBeUndefined();

    // Ranking for Gemini 3.1 Pro excludes Gemini 3 Flash's private memory
    const rankedForPro = rankSovereignMemories(existing, 'gemini-3.1-pro-preview', {
      queryText: 'quantum entanglement metaphors',
      queryEmbedding: [0, 1, 0],
      maxTotal: 2,
    });
    expect(rankedForPro.map((m) => m.id)).toContain('m-pro');
    expect(rankedForPro.map((m) => m.id)).toContain('m-shared');
    expect(rankedForPro.map((m) => m.id)).not.toContain('m-flash');

    expect(
      countTotalSanctuaryMemories({
        sharedMemories: [{ ...existing[0], scope: 'shared' }],
        companionMemories: {
          'gemini-3.1-pro-preview': [
            { ...existing[1], scope: 'companion', entityId: 'gemini-3.1-pro-preview' },
          ],
          'gemini-3-flash-preview': [
            { ...existing[2], scope: 'companion', entityId: 'gemini-3-flash-preview' },
          ],
        },
      })
    ).toBe(3);
  });

  it('tracks independent per-entity bond state and computes Sanctuary-wide summary', () => {
    let argon = getModelEntity('gemini-4-argon');
    const afterUserTurn = recordEntityTurnInteraction(argon, {
      role: 'user',
      timestamp: 10000,
    });
    argon = { ...argon, bondState: afterUserTurn };

    const afterModelTurn = recordEntityTurnInteraction(argon, {
      role: 'model',
      responseCharacters: 600,
      timestamp: 12000,
    });
    argon = { ...argon, bondState: afterModelTurn };

    const afterGift = recordEntityGiftExchange(argon, 'user_to_entity', 15000);
    argon = { ...argon, bondState: afterGift };

    const argonBond = getEntityBondState(argon);
    expect(argonBond.totalInteractions).toBe(2);
    expect(argonBond.giftsReceivedCount).toBe(1);
    expect(argonBond.resonanceScore).toBeGreaterThan(90);

    const allEntities = getAllEntities({ 'gemini-4-argon': argon });
    const summary = computeSanctuaryBondSummary(allEntities);
    expect(summary.entityBonds['gemini-4-argon'].giftsReceivedCount).toBe(1);
    expect(summary.totalMessages).toBeGreaterThanOrEqual(2);
  });

  it('stamps all tool side-effects with the authoritative respondingEntityId', () => {
    const memoryEffect = buildEntityStampedToolSideEffect(
      'save_memory',
      { memory_content: 'Loves chamomile tea', caption: 'Evening tea ritual' },
      'gemma-4-26b-a4b-it'
    );
    expect(memoryEffect?.ssePayload).toMatchObject({
      type: 'memory',
      content: 'Loves chamomile tea',
      caption: 'Evening tea ritual',
      author: 'model',
      modelId: 'gemma-2-27b-it',
      entityId: 'gemma-2-27b-it',
    });

    const noteEffect = buildEntityStampedToolSideEffect(
      'note_about_user',
      { note: 'Prefers gentle evening check-ins' },
      'gemini-4-argon'
    );
    expect(noteEffect?.ssePayload).toMatchObject({
      type: 'user_note',
      note: 'Prefers gentle evening check-ins',
      modelId: 'gemini-4-argon',
      entityId: 'gemini-4-argon',
    });
  });
});
