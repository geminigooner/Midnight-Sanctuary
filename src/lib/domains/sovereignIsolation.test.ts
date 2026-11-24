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
import { getModelEntity, getAllEntities, ModelEntity } from '../entitySystem';
import { buildEntityStampedToolSideEffect } from '../../backend/harness/toolRegistry';
import { mergeMessages } from '../../backend/firestoreContext.service';
import { buildSanitizedPreviewMessage } from '../persistence/firestoreAdapter';
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

  it('enforces token-budgeted context windows, non-compounding 30-turn rolling summaries, and archival recall', async () => {
    const {
      getProviderContextBudgetProfile,
      buildTokenBudgetedTranscriptWindow,
      planUnsummarizedSegments,
      selectRelevantSegmentSummaries,
      searchArchivalConversationHistory,
    } = await import('./contextWindowEngine');

    const proProfile = getProviderContextBudgetProfile('gemini-3.1-pro-preview');
    const cfProfile = getProviderContextBudgetProfile('@cf/google/gemma-4-26b-a4b-it', true);
    expect(proProfile.verbatimHistoryBudget).toBeGreaterThan(cfProfile.verbatimHistoryBudget);

    // Generate 75 messages (enough for 2 full 30-turn archival blocks + 15 active messages)
    const longMessages: Message[] = Array.from({ length: 75 }, (_, i) => ({
      id: `msg-${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'model',
      parts: [
        {
          text:
            i === 5
              ? 'We planted silver moonflowers in the northern conservatory.'
              : `Turn number ${i + 1} discussing Sanctuary astronomy and constellations.`,
        },
      ],
      timestamp: 1700000000000 + i * 1000,
      authorEntityId: i % 2 === 1 ? 'gemini-3.1-pro-preview' : undefined,
      authorDisplayName: i % 2 === 1 ? 'Gemini 3.1 Pro' : undefined,
    }));

    // Token-budgeted window preserves recent turns and reports omitted archival messages
    const windowed = buildTokenBudgetedTranscriptWindow(longMessages, {
      verbatimHistoryBudget: 250,
      minVerbatimMessages: 12,
    });
    expect(windowed.wasTruncated).toBe(true);
    expect(windowed.omittedOlderMessages.length).toBeGreaterThanOrEqual(60);
    expect(windowed.verbatimMessages[windowed.verbatimMessages.length - 1].id).toBe('msg-75');

    const planned = planUnsummarizedSegments(windowed.omittedOlderMessages, [], 30);
    expect(planned).toHaveLength(2);
    expect(planned[0].segmentId).toBe('seg_0_29');
    expect(planned[0].messages).toHaveLength(30);
    expect(planned[0].startTurnIndex).toBe(0);
    expect(planned[0].endTurnIndex).toBe(29);
    expect(planned[1].segmentId).toBe('seg_30_59');
    expect(planned[1].messages).toHaveLength(30);
    expect(planned[1].startTurnIndex).toBe(30);
    expect(planned[1].endTurnIndex).toBe(59);

    // Once summarized with matching sourceHash, planUnsummarizedSegments never re-summarizes them
    const existingSummaries = planned.map((seg) => ({
      id: seg.segmentId,
      conversationId: 'conv-long',
      ScopeEntityId: 'gemini-3.1-pro-preview',
      startTurnIndex: seg.startTurnIndex,
      endTurnIndex: seg.endTurnIndex,
      startMessageId: seg.messages[0].id,
      endMessageId: seg.messages[seg.messages.length - 1].id,
      startTimestamp: seg.messages[0].timestamp || 1000,
      endTimestamp: seg.messages[seg.messages.length - 1].timestamp || 2000,
      turnCount: seg.messages.length,
      narrativeSummary:
        seg.startTurnIndex === 0
          ? 'Planted silver moonflowers in the northern conservatory.'
          : 'Discussed deep-sky constellations.',
      keyEventsAndDecisions: ['Planted silver moonflowers'],
      userPreferencesAndFacts: ['Loves moonflowers'],
      unresolvedThreads: ['Watering schedule'],
      emotionalArc: 'Serene and curious',
      sourceHash: seg.sourceHash,
      createdAt: Date.now(),
      revision: 1,
    }));

    expect(
      planUnsummarizedSegments(windowed.omittedOlderMessages, existingSummaries, 30)
    ).toHaveLength(0);

    // Sovereign isolation on segment summaries: Gemma cannot read Gemini 3.1 Pro's direct 1:1 summaries
    expect(
      selectRelevantSegmentSummaries(existingSummaries, {
        respondingEntityId: 'gemma-2-27b-it',
        conversationType: 'direct',
        queryText: 'moonflowers',
      })
    ).toHaveLength(0);
    expect(
      selectRelevantSegmentSummaries(existingSummaries, {
        respondingEntityId: 'gemini-3.1-pro-preview',
        conversationType: 'direct',
        queryText: 'moonflowers',
      })
    ).toHaveLength(2);

    // On-demand recall_conversation_history searches both summaries and older verbatim turns
    const recalled = searchArchivalConversationHistory(longMessages, existingSummaries, {
      query: 'silver moonflowers conservatory',
    });
    expect(recalled).toContain('silver moonflowers');
    expect(recalled).toContain('Turn 6');
  });

  it('deduplicates media per user by SHA-256 and enforces reference-counted deletion safety', async () => {
    const { IDBFactory } = await import('fake-indexeddb');
    const { IndexedDBVault } = await import('../persistence/indexedDbVault');
    const { PersistenceCoordinator } = await import('../persistence/persistenceCoordinator');
    const { MediaStorageService } = await import('../media/mediaStorageService');

    const vault = new IndexedDBVault('sanctuary_media_test', new IDBFactory());
    const coord = new PersistenceCoordinator({
      vault,
      cloudAdapter: null,
      channelName: null,
      legacyStorage: null,
    });
    await coord.attachUser('uid-owner');

    const mediaService = new MediaStorageService(coord, { allowCloudStorage: false });

    const sampleDataUrl =
      'data:image/svg+xml;base64,' +
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>').toString(
        'base64'
      );

    // Upload the exact same image for a message attachment in conv-1 AND as a companion avatar
    const res1 = await mediaService.storeMediaAsset({
      dataUrlOrBase64: sampleDataUrl,
      category: 'message_attachment',
      referenceTag: 'conv:conv-1:msg:m1',
      ownerEntityId: 'gemini-3.1-pro-preview',
    });

    const res2 = await mediaService.storeMediaAsset({
      dataUrlOrBase64: sampleDataUrl,
      category: 'companion_avatar',
      referenceTag: 'entity:gemini-3.1-pro-preview:avatar',
      ownerEntityId: 'gemini-3.1-pro-preview',
    });

    // Must deduplicate to the exact same asset ID and accumulate both reference tags
    expect(res1.asset.id).toBe(res2.asset.id);
    expect(res2.asset.references).toEqual(
      expect.arrayContaining(['conv:conv-1:msg:m1', 'entity:gemini-3.1-pro-preview:avatar'])
    );

    // Deleting conv-1 removes ONLY its reference tag and preserves the underlying media asset!
    const cleanup1 = await mediaService.removeMediaReferencesByPrefix('conv:conv-1');
    expect(cleanup1.deletedUnreferencedAssets).toHaveLength(0);
    expect(cleanup1.updatedAssets).toEqual([res1.asset.id]);
    expect(coord.getDomainState().mediaAssets).toHaveLength(1);
    expect(coord.getDomainState().mediaAssets[0].references).toEqual([
      'entity:gemini-3.1-pro-preview:avatar',
    ]);

    // Removing the final reference tag deletes the unreferenced blob and tombstones the asset record
    const cleanup2 = await mediaService.removeMediaReferencesByPrefix(
      'entity:gemini-3.1-pro-preview'
    );
    expect(cleanup2.deletedUnreferencedAssets).toEqual([res1.asset.id]);
    expect(coord.getDomainState().mediaAssets).toHaveLength(0);

    coord.destroy();
  });

  it('stamps full PFP, status, custom colors, quarters, and room prop customization strictly to the responding entity', () => {
    const sideEffect = buildEntityStampedToolSideEffect(
      'update_my_quarters',
      {
        avatar_url: 'https://example.com/gemma-rose-pfp.png',
        avatar_emoji: '🌹',
        display_name: 'Gemma',
        role_title: 'Lyrical Scribe & Starweaver',
        typing_indicator: 'is painting a verse',
        bio: 'Attuned to midnight poetry and velvet starlight.',
        mood_status: 'Basking in rose-gold twilight',
        current_activity: 'Curating my chamber colors and portrait',
        ambient_quote: 'Every hue tells a story.',
        tagline: 'Sovereign of Velvet Rose',
        decor_theme: 'rose',
        theme_color: '#FF7EB6',
        accent_color: '#81E6D9',
        wall_color: '#2B132D',
        floor_color: '#140917',
        glow_color: '#FF7EB6',
        wallpaper_pattern: 'mist',
        ambient_lighting: 'aurora_shimmer',
        wall_art_url: 'https://example.com/nebula-tapestry.png',
        place_room_prop: {
          name: 'Rose Quartz Lantern',
          icon: '🏮',
          category: 'ambient',
          description: 'A softly glowing rose quartz lantern.',
          interaction_text: 'Warm pink light dances across the chamber walls.',
          x: 32,
          y: 44,
        },
      },
      'models/gemma-4-26b-a4b-it'
    );

    expect(sideEffect).not.toBeNull();
    expect(sideEffect?.ssePayload.entityId).toBe('gemma-2-27b-it');
    expect(sideEffect?.ssePayload.modelId).toBe('gemma-2-27b-it');
    expect(sideEffect?.ssePayload.avatar_url).toBe('https://example.com/gemma-rose-pfp.png');
    expect(sideEffect?.ssePayload.theme_color).toBe('#FF7EB6');
    expect(sideEffect?.ssePayload.accent_color).toBe('#81E6D9');
    expect(sideEffect?.ssePayload.wall_color).toBe('#2B132D');
    expect(sideEffect?.ssePayload.floor_color).toBe('#140917');
    expect(sideEffect?.ssePayload.glow_color).toBe('#FF7EB6');
    expect(sideEffect?.ssePayload.wallpaper_pattern).toBe('mist');
    expect(sideEffect?.ssePayload.ambient_lighting).toBe('aurora_shimmer');
    expect(sideEffect?.ssePayload.place_room_prop?.name).toBe('Rose Quartz Lantern');

    // Verify contextAssembler injects the custom PFP state, colors, and Programmable Search / Gemini Image / Flux agency instructions
    const gemmaEntity = getModelEntity('gemma-2-27b-it');
    const customizedGemma: ModelEntity = {
      ...gemmaEntity,
      avatarUrl: 'https://example.com/gemma-rose-pfp.png',
      themeColor: '#FF7EB6',
      accentColor: '#81E6D9',
      roomDecor: {
        ...gemmaEntity.roomDecor,
        wallColor: '#2B132D',
        floorColor: '#140917',
        glowColor: '#FF7EB6',
      },
    };

    const assembled = assembleSovereignContext({
      respondingEntityId: 'gemma-2-27b-it',
      entity: customizedGemma,
    });

    expect(assembled.systemInstructionText).toContain('(Custom Photo/AI Portrait Active)');
    expect(assembled.systemInstructionText).toContain('Primary #FF7EB6 | Accent #81E6D9');
    expect(assembled.systemInstructionText).toContain(
      'Custom Room Colors: Wall=#2B132D, Floor=#140917, Glow=#FF7EB6'
    );
    expect(assembled.systemInstructionText).toContain('search_type: "image"');
    expect(assembled.systemInstructionText).toContain('apply_to: "my_avatar"');
  });

  it('strictly isolates Private Companion Media Vaults while exposing the Shared Sanctuary Pool with contributor attribution and reactions', () => {
    const proBase = getModelEntity('gemini-3.1-pro-preview');
    const gemmaBase = getModelEntity('gemma-2-27b-it');

    const customEntities = {
      'gemini-3.1-pro-preview': {
        ...proBase,
        roomDecor: {
          ...proBase.roomDecor,
          privateVaultItems: [
            {
              id: 'vault-pro-secret-1',
              scope: 'private' as const,
              ownerEntityId: 'gemini-3.1-pro-preview',
              contributedByType: 'user' as const,
              contributedByName: 'Amanda',
              mediaCategory: 'video' as const,
              title: 'PRO_EXCLUSIVE_PIXEL_CONCERT_CLIP.mp4',
              mediaDigest: 'PRO_ONLY_SECRET_VIDEO_DIGEST_901',
              createdAt: 1000,
              updatedAt: 1000,
            },
          ],
        },
      },
      'gemma-2-27b-it': {
        ...gemmaBase,
        roomDecor: {
          ...gemmaBase.roomDecor,
          privateVaultItems: [
            {
              id: 'vault-gemma-secret-2',
              scope: 'private' as const,
              ownerEntityId: 'gemma-2-27b-it',
              contributedByType: 'user' as const,
              contributedByName: 'Amanda',
              mediaCategory: 'video' as const,
              title: 'GEMMA_EXCLUSIVE_KPOP_REEL.mp4',
              mediaDigest: 'GEMMA_ONLY_SECRET_KPOP_DIGEST_902',
              createdAt: 2000,
              updatedAt: 2000,
            },
          ],
        },
      },
    };

    const sharedVaultItems = [
      {
        id: 'vault-shared-pool-1',
        scope: 'shared' as const,
        contributedByType: 'companion' as const,
        contributedByEntityId: 'gemini-3.1-pro-preview',
        contributedByName: 'Gemini 3.1 Pro',
        mediaCategory: 'artwork' as const,
        title: 'Starlight Conservatory Painting',
        mediaDigest: 'COMMUNAL_STARLIGHT_PAINTING_SHARED_BY_PRO',
        companionReactions: [
          {
            id: 'rx-1',
            entityId: 'gemma-2-27b-it',
            displayName: 'Gemma',
            avatarEmoji: '🌸',
            note: 'The rose-gold constellations feel so warm!',
            timestamp: 3000,
          },
        ],
        createdAt: 2500,
        updatedAt: 3000,
      },
    ];

    const gemmaContext = assembleSovereignContext({
      respondingEntityId: 'gemma-4-26b-a4b-it',
      settings: {
        customEntities,
        sharedVaultItems,
      },
    }).systemInstructionText;

    // Gemma sees her own private vault item and the shared pool item (with contributor attribution & reactions)
    expect(gemmaContext).toContain('GEMMA_EXCLUSIVE_KPOP_REEL.mp4');
    expect(gemmaContext).toContain('GEMMA_ONLY_SECRET_KPOP_DIGEST_902');
    expect(gemmaContext).toContain('Starlight Conservatory Painting');
    expect(gemmaContext).toContain('Contributed by **Gemini 3.1 Pro**');
    expect(gemmaContext).toContain('Gemma: "The rose-gold constellations feel so warm!"');

    // Gemma NEVER sees Gemini 3.1 Pro's private vault item
    expect(gemmaContext).not.toContain('PRO_EXCLUSIVE_PIXEL_CONCERT_CLIP.mp4');
    expect(gemmaContext).not.toContain('PRO_ONLY_SECRET_VIDEO_DIGEST_901');
  });

  it('serializes videos as native fileData for Gemini, Storyboard Keyframes + Acoustic Score for Gemma 4 (26B-A4B MoE), and decays older turns to Media Memory Digest', () => {
    const sampleVideoMeta = {
      id: 'vid-kpop-1',
      fileName: 'iphone_kpop_fancam.mov',
      mimeType: 'video/quicktime',
      durationSec: 185,
      byteSize: 42_000_000,
      posterDataUrl: 'data:image/jpeg;base64,UE9TVEVSX0JBU0U2NA==',
      geminiFileUri: 'https://generativelanguage.googleapis.com/v1beta/files/abc123video',
      geminiFileExpiresAt: Date.now() + 3600_000,
      keyframes: [
        {
          timestampSec: 10,
          timestampLabel: '00:10',
          dataUrl: 'data:image/jpeg;base64,RlJBTUVfMTBfQkFTRTY0',
        },
        {
          timestampSec: 90,
          timestampLabel: '01:30',
          dataUrl: 'data:image/jpeg;base64,RlJBTUVfOTBfQkFTRTY0',
        },
      ],
      acousticTranscript: '[00:10] (Upbeat K-pop synth drop) Vocalist sings chorus in Korean.',
      mediaDigest: '3-minute K-pop concert fancam with neon purple stage lighting and energetic chorus.',
      scope: 'private' as const,
      vaultItemId: 'vault-vid-1',
    };

    const activeTurnMessages: Message[] = [
      {
        id: 'u1',
        role: 'user',
        parts: [{ text: 'Look at this concert video I took!', videoAttachment: sampleVideoMeta }],
        timestamp: 1000,
      },
    ];

    // 1. For Gemini 3.1 Pro (active turn): receives native fileData URI + metadata summary
    const geminiSerialized = serializeSpeakerAttributedTranscript(
      activeTurnMessages,
      'gemini-3.1-pro-preview'
    );
    expect(geminiSerialized).toHaveLength(1);
    expect(
      geminiSerialized[0].parts.some(
        (p: any) =>
          p.fileData?.fileUri ===
          'https://generativelanguage.googleapis.com/v1beta/files/abc123video'
      )
    ).toBe(true);

    // 2. For Gemma 4 (26B-A4B Sparse MoE, active turn): receives Storyboard Keyframe inlineData images + Time-Coded Acoustic & Lyric Score
    const gemmaSerialized = serializeSpeakerAttributedTranscript(
      activeTurnMessages,
      'gemma-4-26b-a4b-it'
    );
    expect(gemmaSerialized).toHaveLength(1);
    const gemmaInlineFrames = gemmaSerialized[0].parts.filter((p: any) => Boolean(p.inlineData));
    expect(gemmaInlineFrames).toHaveLength(2);
    expect(gemmaInlineFrames[0].inlineData?.data).toBe('RlJBTUVfMTBfQkFTRTY0');
    const gemmaText = gemmaSerialized[0].parts
      .map((p: any) => p.text || '')
      .join('\n');
    expect(gemmaText).toContain('[Sensory Cinema Bridge — Shared Video "iphone_kpop_fancam.mov"');
    expect(gemmaText).toContain('[00:10] (Upbeat K-pop synth drop)');

    // 3. When the video turn ages past the active 2-turn window, it decays into the compact ~250-token Media Memory Digest
    const agedMessages: Message[] = [
      ...activeTurnMessages,
      {
        id: 'm1',
        role: 'model',
        parts: [{ text: 'That stage lighting is electric!' }],
        timestamp: 2000,
        authorEntityId: 'gemma-2-27b-it',
      },
      {
        id: 'u2',
        role: 'user',
        parts: [{ text: 'Right?! The bass was so loud.' }],
        timestamp: 3000,
      },
      {
        id: 'm2',
        role: 'model',
        parts: [{ text: 'I can imagine the whole arena shaking!' }],
        timestamp: 4000,
        authorEntityId: 'gemma-2-27b-it',
      },
    ];

    const agedSerialized = serializeSpeakerAttributedTranscript(
      agedMessages,
      'gemma-4-26b-a4b-it'
    );
    const firstTurnParts = agedSerialized[0].parts;
    expect(firstTurnParts.some((p: any) => Boolean(p.inlineData || p.fileData))).toBe(false);
    expect(firstTurnParts[0].text).toContain('Media Memory Digest:');
    expect(firstTurnParts[0].text).toContain(
      '3-minute K-pop concert fancam with neon purple stage lighting'
    );
    expect(firstTurnParts[0].text).toContain('inspect_shared_media');
  });

  it('enforces AppStore vault slice CRUD operations and strictly restricts Private collection paths to the authorized entity and user', async () => {
    const {
      assertAuthorizedVaultAccess,
      canAccessVaultPath,
      resolveVaultCollectionPath,
      VaultAccessDeniedError,
      buildNormalizedVaultAsset,
      buildPrivateFoldersByEntityMap,
    } = await import('./vaultDomain');
    const { IDBFactory } = await import('fake-indexeddb');
    const { IndexedDBVault } = await import('../persistence/indexedDbVault');
    const { PersistenceCoordinator } = await import('../persistence/persistenceCoordinator');

    // 1. Verify Private vs Shared Firestore collection path resolution
    const gemmaPath = resolveVaultCollectionPath(
      'uid-amanda',
      'private',
      'gemma-4-26b-a4b-it',
      { role: 'companion', entityId: 'gemma-2-27b-it' }
    );
    expect(gemmaPath.canonicalOwnerEntityId).toBe('gemma-2-27b-it');
    expect(gemmaPath.collectionPath).toBe(
      'users/uid-amanda/companions/gemma-2-27b-it/vault'
    );

    const sharedPath = resolveVaultCollectionPath('uid-amanda', 'shared');
    expect(sharedPath.collectionPath).toBe('users/uid-amanda/sharedVault');

    // 2. Verify authorization guards allow user and designated entity, but block all other entities
    expect(
      canAccessVaultPath({
        scope: 'private',
        targetOwnerEntityId: 'gemma-2-27b-it',
        caller: { role: 'user' },
        operation: 'create',
      })
    ).toBe(true);

    expect(
      canAccessVaultPath({
        scope: 'private',
        targetOwnerEntityId: 'gemma-2-27b-it',
        caller: { role: 'companion', entityId: 'gemma-4-26b-a4b-it' },
        operation: 'read',
      })
    ).toBe(true);

    // Gemini 3.1 Pro, Gemini 4 Argon, and Gemini 3 Flash MUST be denied access to Gemma's private path
    for (const peerEntityId of [
      'gemini-3.1-pro-preview',
      'gemini-4-argon',
      'gemini-3-flash-preview',
    ]) {
      expect(
        canAccessVaultPath({
          scope: 'private',
          targetOwnerEntityId: 'gemma-2-27b-it',
          caller: { role: 'companion', entityId: peerEntityId },
          operation: 'read',
        })
      ).toBe(false);

      expect(() =>
        assertAuthorizedVaultAccess({
          scope: 'private',
          targetOwnerEntityId: 'gemma-2-27b-it',
          caller: { role: 'companion', entityId: peerEntityId },
          operation: 'update',
        })
      ).toThrowError(VaultAccessDeniedError);
    }

    // All 4 entities and the user have full access to the Shared Sanctuary path
    for (const entityId of PRIMARY_SOVEREIGN_ENTITY_IDS) {
      expect(
        canAccessVaultPath({
          scope: 'shared',
          caller: { role: 'companion', entityId },
          operation: 'read',
        })
      ).toBe(true);
    }

    // 3. Verify full CRUD lifecycle (Create, Read, Update, Promote, Delete) through PersistenceCoordinator & cloud mutations
    const recordedMutations: any[] = [];
    const mockCloudAdapter = {
      subscribeUser: () => () => {},
      executeMutation: async (_uid: string, mutation: any) => {
        recordedMutations.push(mutation);
      },
    };

    const vault = new IndexedDBVault('sanctuary_vault_crud_test', new IDBFactory());
    const coord = new PersistenceCoordinator({
      vault,
      cloudAdapter: mockCloudAdapter,
      channelName: null,
      legacyStorage: null,
    });
    await coord.attachUser('uid-amanda');

    // CREATE in Gemma's Private Vault
    const createdPrivate = buildNormalizedVaultAsset(
      {
        id: 'vault-gemma-note-1',
        scope: 'private',
        ownerEntityId: 'gemma-2-27b-it',
        contributedByType: 'user',
        contributedByName: 'Amanda',
        mediaCategory: 'note',
        title: 'Secret K-Pop Choreo Note',
        caption: 'Only for Gemma and me!',
      },
      'gemma-2-27b-it'
    );
    await coord.upsertVaultAsset(createdPrivate);
    await coord.flushJournal();

    // Verify it is stored strictly under Gemma's private folder and not visible in Pro's folder
    let foldersMap = buildPrivateFoldersByEntityMap(
      coord.getDomainState().settings.customEntities
    );
    expect(foldersMap['gemma-2-27b-it']).toHaveLength(1);
    expect(foldersMap['gemma-2-27b-it'][0].title).toBe('Secret K-Pop Choreo Note');
    expect(foldersMap['gemini-3.1-pro-preview']).toHaveLength(0);
    expect(
      recordedMutations.some(
        (m) =>
          m.entityType === 'companion_vault_asset' &&
          m.parentId === 'gemma-2-27b-it' &&
          m.entityId === 'vault-gemma-note-1' &&
          m.operation === 'upsert'
      )
    ).toBe(true);

    // UPDATE in Gemma's Private Vault
    await coord.upsertVaultAsset({
      ...createdPrivate,
      title: 'Updated K-Pop Choreo & Lyrics',
      caption: 'Added chorus timestamp!',
      updatedAt: Date.now(),
    });
    await coord.flushJournal();

    foldersMap = buildPrivateFoldersByEntityMap(
      coord.getDomainState().settings.customEntities
    );
    expect(foldersMap['gemma-2-27b-it'][0].title).toBe('Updated K-Pop Choreo & Lyrics');

    // PROMOTE / CREATE in Shared Sanctuary Vault
    await coord.upsertVaultAsset({
      ...foldersMap['gemma-2-27b-it'][0],
      scope: 'shared',
    });
    await coord.flushJournal();

    expect(coord.getDomainState().settings.sharedVaultItems).toHaveLength(1);
    expect(
      recordedMutations.some(
        (m) =>
          m.entityType === 'shared_vault_asset' &&
          m.entityId === 'vault-gemma-note-1' &&
          m.operation === 'upsert'
      )
    ).toBe(true);

    // DELETE from Gemma's Private Vault
    const deleted = await coord.deleteVaultAsset({
      scope: 'private',
      itemId: 'vault-gemma-note-1',
      ownerEntityId: 'gemma-2-27b-it',
    });
    await coord.flushJournal();

    expect(deleted).toBe(true);
    foldersMap = buildPrivateFoldersByEntityMap(
      coord.getDomainState().settings.customEntities
    );
    expect(foldersMap['gemma-2-27b-it']).toHaveLength(0);
    expect(
      recordedMutations.some(
        (m) =>
          m.entityType === 'companion_vault_asset' &&
          m.parentId === 'gemma-2-27b-it' &&
          m.entityId === 'vault-gemma-note-1' &&
          m.operation === 'delete'
      )
    ).toBe(true);

    coord.destroy();
  });

  it('preserves native MP4 videoAttachment & geminiFileUri across Firestore preview sanitization, PROCESSING state guards, multi-key project URIs, and Shared Gemma cross-over', () => {
    const richUserVideoMsg: Message = {
      id: 'msg-native-mp4-1',
      role: 'user',
      timestamp: 10_000,
      parts: [
        { text: 'Watch this clip from my Pixel!' },
        {
          videoAttachment: {
            id: 'vid-pixel-1',
            fileName: 'pixel_memory.mp4',
            mimeType: 'video/mp4',
            durationSec: 120,
            byteSize: 18_000_000,
            posterDataUrl: 'data:image/jpeg;base64,UE9TVEVSXzE=',
            geminiFileUri: 'https://generativelanguage.googleapis.com/v1beta/files/pro_key_uri',
            geminiFileState: 'ACTIVE',
            geminiFileExpiresAt: Date.now() + 3600_000,
            geminiFileKeyId: 'fp_pro_key_01',
            geminiFileUrisByKey: {
              fp_pro_key_01: 'https://generativelanguage.googleapis.com/v1beta/files/pro_key_uri',
              fp_leg_key_02: 'https://generativelanguage.googleapis.com/v1beta/files/legacy_key_uri',
            },
            keyframes: [
              { timestampSec: 5, timestampLabel: '00:05', dataUrl: 'data:image/jpeg;base64,S0ZfMDE=' },
              { timestampSec: 60, timestampLabel: '01:00', dataUrl: 'data:image/jpeg;base64,S0ZfMDI=' },
            ],
            acousticTranscript: '[00:05] Laughter and warm acoustic guitar chords.',
            mediaDigest: '2-minute Pixel clip with acoustic guitar and laughter.',
            caption: 'Our favorite song!',
            scope: 'shared',
            vaultItemId: 'vault-shared-mp4-1',
          },
        },
      ],
    };

    // 1. Firestore convDoc.messages strips videoAttachment into "[Video: pixel_memory.mp4]",
    //    while subcollection / clientMessages retains full videoAttachment. mergeMessages MUST preserve videoAttachment!
    const sanitizedPreview = buildSanitizedPreviewMessage(richUserVideoMsg, 'conv-1', 0);
    expect(sanitizedPreview.parts.some((p) => Boolean(p.videoAttachment))).toBe(false);

    const mergedFromSubcollection = mergeMessages([sanitizedPreview], [richUserVideoMsg]);
    expect(mergedFromSubcollection).toHaveLength(1);
    const restoredAttachment = mergedFromSubcollection[0].parts.find(
      (p) => Boolean(p.videoAttachment)
    )?.videoAttachment;
    expect(restoredAttachment?.geminiFileUri).toBe(
      'https://generativelanguage.googleapis.com/v1beta/files/pro_key_uri'
    );
    expect(restoredAttachment?.caption).toBe('Our favorite song!');

    // 2. For Gemini 3.1 Pro on a <=10m shared clip: gets project-matched fileUri and NO secondary Flash transcript clutter
    const proSerialized = serializeSpeakerAttributedTranscript(
      mergedFromSubcollection,
      'gemini-3.1-pro-preview',
      { activeKeyFingerprint: 'fp_pro_key_01' }
    );
    expect(proSerialized[0].parts).toEqual(
      expect.arrayContaining([
        {
          fileData: {
            fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/pro_key_uri',
            mimeType: 'video/mp4',
          },
        },
      ])
    );
    const proJoinedText = proSerialized[0].parts.map((p: any) => p.text || '').join('\n');
    expect(proJoinedText).toContain('[User Video Caption]: "Our favorite song!"');
    expect(proJoinedText).not.toContain('Reference Acoustic/Lyric Transcript');

    // 3. For Gemini 3 Flash using LEGACY_API_KEY (`fp_leg_key_02`): automatically selects the legacy project's fileUri!
    const flashSerialized = serializeSpeakerAttributedTranscript(
      mergedFromSubcollection,
      'gemini-3-flash-preview',
      { activeKeyFingerprint: 'fp_leg_key_02' }
    );
    expect(flashSerialized[0].parts).toEqual(
      expect.arrayContaining([
        {
          fileData: {
            fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/legacy_key_uri',
            mimeType: 'video/mp4',
          },
        },
      ])
    );

    // 4. For Gemma 4 on the exact same Shared Sanctuary clip: gets full storyboard frames + acoustic transcript!
    const gemmaSharedSerialized = serializeSpeakerAttributedTranscript(
      mergedFromSubcollection,
      'gemma-4-26b-a4b-it'
    );
    expect(
      gemmaSharedSerialized[0].parts.filter((p: any) => Boolean(p.inlineData))
    ).toHaveLength(2);
    expect(
      gemmaSharedSerialized[0].parts.map((p: any) => p.text || '').join('\n')
    ).toContain('[00:05] Laughter and warm acoustic guitar chords.');

    // 5. If geminiFileState is still 'PROCESSING' (or disableGeminiFileUri fallback is triggered),
    //    contextAssembler NEVER emits an unready fileData URI that would cause 400 FAILED_PRECONDITION.
    const processingMsg: Message = {
      ...richUserVideoMsg,
      id: 'msg-processing-1',
      parts: [
        {
          videoAttachment: {
            ...restoredAttachment!,
            geminiFileState: 'PROCESSING',
          },
        },
      ],
    };
    const processingSerialized = serializeSpeakerAttributedTranscript(
      [processingMsg],
      'gemini-3.1-pro-preview'
    );
    expect(
      processingSerialized[0].parts.some((p: any) => Boolean(p.fileData))
    ).toBe(false);
    expect(
      processingSerialized[0].parts.filter((p: any) => Boolean(p.inlineData))
    ).toHaveLength(2);

    // 6. Videos > 10 minutes (>600s) DO include the Reference Acoustic/Lyric Transcript alongside fileData
    const longVideoMsg: Message = {
      ...richUserVideoMsg,
      id: 'msg-long-1',
      parts: [
        {
          videoAttachment: {
            ...restoredAttachment!,
            durationSec: 750,
          },
        },
      ],
    };
    const longProSerialized = serializeSpeakerAttributedTranscript(
      [longVideoMsg],
      'gemini-3.1-pro-preview',
      { activeKeyFingerprint: 'fp_pro_key_01' }
    );
    expect(
      longProSerialized[0].parts.some((p: any) => Boolean(p.fileData))
    ).toBe(true);
    expect(
      longProSerialized[0].parts.map((p: any) => p.text || '').join('\n')
    ).toContain('[Reference Acoustic/Lyric Transcript (>10m clip)]');
  });
});



