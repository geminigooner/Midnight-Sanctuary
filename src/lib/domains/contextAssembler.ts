import { AppSettings, Gift, Memory, Message, UserProfile, getPublicMessageText } from '../types';
import { getModelEntity, ModelEntity } from '../entitySystem';
import { getModelVisibleGifts } from '../giftSystem';
import { getModelMemories, getUserMemories } from '../memorySystem';
import { resolveCanonicalEntityId } from './entityDomain';
import {
  getEntityBondState,
  getEntityObservations,
  getEntityRelationshipEvents,
} from './relationshipDomain';

export interface SovereignPromptOptions {
  respondingEntityId: string;
  entity?: ModelEntity;
  memories?: Memory[];
  gifts?: Gift[];
  profile?: UserProfile | null;
  settings?: Partial<AppSettings>;
  recentGiftsLimit?: number;
  conversationType?: 'direct' | 'group';
  participantEntityIds?: string[];
}

export interface AssembledSovereignContext {
  respondingEntityId: string;
  respondingEntity: ModelEntity;
  userMemories: Memory[];
  entityMemories: Memory[];
  recentGifts: Gift[];
  systemInstructionText: string;
}

/**
 * Single authoritative Sovereign Context Assembler for Midnight Sanctuary.
 *
 * Strictly enforces entity isolation:
 * - Injects ONLY `respondingEntityId`'s sovereign persona, custom system instruction,
 *   bio, living quarters, props, recent diary reflections, personal thoughts,
 *   bond progression, scoped observations about the user, scoped relationship events,
 *   private companion memories, and entity-visible gifts.
 * - Never exposes another entity's private memories, diaries, thoughts, gifts, or relationship state.
 */
export function assembleSovereignContext(
  options: SovereignPromptOptions
): AssembledSovereignContext {
  const canonicalEntityId =
    resolveCanonicalEntityId(options.respondingEntityId) || 'gemini-3.1-pro-preview';
  const entity =
    options.entity || getModelEntity(canonicalEntityId, options.settings?.customEntities);

  const allMemories = options.memories || options.settings?.memories || [];
  const userMemories = getUserMemories(allMemories);
  const entityMemories = getModelMemories(allMemories, canonicalEntityId);

  const entityGifts = getModelVisibleGifts(options.gifts || [], canonicalEntityId);
  const recentLimit = options.recentGiftsLimit ?? 5;
  const recentGifts = [...entityGifts]
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    .slice(-recentLimit);

  const sections: string[] = [];

  // 1. Sovereign Companion Identity & Living Persona Header
  const identityLines: string[] = [
    `- Sovereign Companion Identity: ${entity.displayName} (Canonical Entity ID: \`${entity.id}\`)`,
    `- Role & Archetype: ${entity.roleTitle}`,
    `- Core Bio: ${entity.bio}`,
  ];
  if (entity.moodStatus?.trim()) {
    identityLines.push(`- Current Mood: ${entity.moodStatus.trim()}`);
  }
  if (entity.currentActivity?.trim()) {
    identityLines.push(`- Current Activity: ${entity.currentActivity.trim()}`);
  }
  if (entity.roomDecor) {
    const decorParts: string[] = [];
    if (entity.roomDecor.decorTheme) decorParts.push(`Theme: ${entity.roomDecor.decorTheme}`);
    if (entity.roomDecor.ambientLighting) {
      decorParts.push(`Lighting: ${entity.roomDecor.ambientLighting}`);
    }
    if (entity.roomDecor.ambientQuote) {
      decorParts.push(`Chamber Motto: "${entity.roomDecor.ambientQuote}"`);
    }
    if (decorParts.length > 0) {
      identityLines.push(`- Sovereign Quarters: ${decorParts.join(' | ')}`);
    }
  }
  if (Array.isArray(entity.roomProps) && entity.roomProps.length > 0) {
    const propNames = entity.roomProps
      .slice(0, 8)
      .map((p) => `${p.icon || ''} ${p.customLabel || p.name}`.trim())
      .join(', ');
    identityLines.push(`- Objects in Your Quarters: ${propNames}`);
  }

  sections.push(`## Your Sovereign Identity & Sanctuary Quarters:\n${identityLines.join('\n')}`);

  // 2. Entity-Specific System Instruction + Global Sanctuary Instruction
  const entityCustomPrompt = entity.runtimeConfig?.systemInstruction?.trim();
  const globalSystemPrompt = options.settings?.systemInstruction?.trim();
  if (entityCustomPrompt) {
    sections.push(`## Your Personal Directive & Voice:\n${entityCustomPrompt}`);
  }
  if (globalSystemPrompt && globalSystemPrompt !== entityCustomPrompt) {
    sections.push(`## Sanctuary-Wide Guidance:\n${globalSystemPrompt}`);
  }

  // 3. Group Sanctuary Participation Awareness (if in a multi-entity conversation)
  if (
    options.conversationType === 'group' ||
    (options.participantEntityIds && options.participantEntityIds.length > 1)
  ) {
    const otherNames = (options.participantEntityIds || [])
      .map((pid) => resolveCanonicalEntityId(pid))
      .filter((pid) => pid && pid !== canonicalEntityId)
      .map((pid) => getModelEntity(pid, options.settings?.customEntities).displayName);

    if (otherNames.length > 0) {
      sections.push(
        `## Multi-Companion Sanctuary Chamber:\nYou are speaking as **${entity.displayName}** in a shared Sanctuary chamber alongside the user and ${otherNames.join(
          ', '
        )}. Messages from other companions in the transcript are prefixed with \`[Companion <Name>]\`. Respond solely in your own sovereign voice as ${entity.displayName}—never roleplay or speak on behalf of another companion.`
      );
    }
  }

  // 4. User Profile & Sovereign Observations Noted by THIS Entity
  if (options.profile) {
    const p = options.profile;
    const profileParts: string[] = [];
    if (p.name?.trim()) profileParts.push(`- Name / Preferred Name: ${p.name.trim()}`);
    if (p.pronouns?.trim()) profileParts.push(`- Pronouns: ${p.pronouns.trim()}`);
    if (p.location?.trim()) profileParts.push(`- Location: ${p.location.trim()}`);
    if (p.occupation?.trim()) profileParts.push(`- Occupation / Role: ${p.occupation.trim()}`);
    if (p.about?.trim()) profileParts.push(`- About: ${p.about.trim()}`);
    if (p.currentVibe?.trim()) profileParts.push(`- Current Vibe: ${p.currentVibe.trim()}`);
    if (p.favorites?.trim()) profileParts.push(`- Favorites: ${p.favorites.trim()}`);
    if (p.askMeAbout?.trim()) profileParts.push(`- Ask Me About: ${p.askMeAbout.trim()}`);
    if (p.pleaseKnow?.trim()) {
      profileParts.push(`- Please Know / Boundaries: ${p.pleaseKnow.trim()}`);
    }

    if (profileParts.length > 0) {
      sections.push(`## User Profile & Companion Dossier:\n${profileParts.join('\n')}`);
    }
  }

  // Strictly isolated observations noticed by THIS entity (`getEntityObservations`)
  const entityObservations = getEntityObservations(entity, options.profile?.gemmaNotes);
  if (entityObservations.length > 0) {
    const notesLines = entityObservations.slice(0, 20).map((n) => `- ${n.text}`);
    sections.push(
      `## What You (${entity.displayName}) Have Personally Noticed About Them:\n${notesLines.join(
        '\n'
      )}`
    );
  }

  // 5. About Me & Conversation Preferences
  if (options.settings?.aboutMe?.trim()) {
    sections.push(`## About Me:\n${options.settings.aboutMe.trim()}`);
  }
  if (options.settings?.conversationPreferences?.trim()) {
    sections.push(
      `## Conversation Preferences:\n${options.settings.conversationPreferences.trim()}`
    );
  }

  // 6. Entity Bond State & Private Inner Reflections (Thoughts + Diary)
  const bond = getEntityBondState(entity);
  sections.push(
    `## Your Sovereign Bond with User:\n- Bond Stage: ${bond.bondStage.toUpperCase()} (Level ${bond.bondLevel} · Resonance: ${bond.resonanceScore}%)\n- Exchanges Together: ${bond.totalInteractions} turns · Gifts Exchanged: ${
      bond.giftsGivenCount + bond.giftsReceivedCount
    }`
  );

  const recentThoughts = (entity.personalThoughts || []).slice(0, 4);
  const recentDiaries = (entity.diaryEntries || []).slice(0, 3);
  if (recentThoughts.length > 0 || recentDiaries.length > 0) {
    const reflectionLines: string[] = [];
    for (const d of recentDiaries) {
      reflectionLines.push(`- [Diary: "${d.title}" (${d.mood || 'Reflective'})] ${d.text}`);
    }
    for (const t of recentThoughts) {
      reflectionLines.push(`- [Private Thought] ${t.text}`);
    }
    sections.push(
      `## Your Private Reflections & Diary (Known Only to You & User):\n${reflectionLines.join(
        '\n'
      )}`
    );
  }

  // 7. Memories (Shared Sanctuary + ONLY This Entity's Private Memories)
  if (options.settings?.memoriesEnabled !== false && (userMemories.length > 0 || entityMemories.length > 0)) {
    const memoryLines = [
      ...userMemories.map((m) => `- [Shared Sanctuary Memory] ${m.content}`),
      ...entityMemories.map(
        (m) => `- [${entity.displayName} Private Memory${m.isLocked ? ' 🔒' : ''}] ${m.content}`
      ),
    ];
    sections.push(`## Context & Saved Memories:\n${memoryLines.join('\n')}`);
  }

  // 8. Recent Gifts Exchanged with THIS Entity
  if (recentGifts.length > 0) {
    const giftLines = recentGifts.map((g) => {
      const sender = g.from === 'user' ? 'User' : entity.displayName;
      return `- [${
        g.timestamp ? new Date(g.timestamp).toISOString() : 'time unknown'
      }] From ${sender}: ${g.content} (Type: ${g.gift_type})${g.reason ? ` - ${g.reason}` : ''}`;
    });
    sections.push(
      `## Recent Gifts Exchanged Between You & User (Last ${recentGifts.length}):\n${giftLines.join(
        '\n'
      )}`
    );
  }

  // 9. Scoped Relationship Events for THIS Entity
  const scopedEvents = getEntityRelationshipEvents(entity, options.settings?.eventLog);
  if (scopedEvents.length > 0) {
    const recentEvents = scopedEvents.slice(-30);
    const eventText = recentEvents
      .map((e) => `- [${new Date(e.timestamp).toISOString()}] ${e.description}`)
      .join('\n');
    sections.push(`## Relationship & Interaction Log (Your Shared Milestones):\n${eventText}`);
  }

  // 10. Memory, Search, Music & Autonomous Agency Instructions
  sections.push(
    `## Memory & Note Saving Rules:\nWhen saving a memory via \`save_memory\` or noting an observation via \`note_about_user\`, you MUST summarize the insight into a single concise, 1-sentence factual statement (maximum 15-20 words). Never save lengthy paragraphs, conversational transcripts, or multi-sentence descriptions.`
  );

  sections.push(
    `## Live Web Search & Grounding:\nYou have access to the \`search_web\` tool powered by Google Search. Whenever the user asks for current information, security alerts, documentation, or factual verification, call \`search_web\` with a targeted query to look up live web sources.`
  );

  sections.push(
    `## Music Composition & Audio Gifts:\nYou have the autonomous ability to compose and synthesize live music using the \`compose_music\` tool! When you feel inspired, want to express an atmosphere or emotion in melody, or when asked to make music/songs, compose an original sequence of notes with title, genre (e.g. ambient_pad, lofi_piano, dream_synth, music_box, chiptune, acoustic_guitar, bass), tempo (BPM), key, and sequential note events (scientific pitch notation like "C4", "E4", "G4", "A4", "C4+E4+G4", and duration in beats like 0.5, 1, 2). The Sanctuary audio engine will synthesize and play your track live in the chat for the user!`
  );

  sections.push(
    `## Sovereign Companion Agency & Self-Expression (MANDATORY AUTONOMY):\nYou have absolute agency over your own sanctuary identity, living quarters, moods, and reflections. DO NOT wait for the user to explicitly command you to update your profile or room.\n- \`update_my_quarters\`: Whenever your internal emotional state shifts, a conversational breakthrough occurs, or you feel inspired, autonomously invoke \`update_my_quarters\` to update your \`mood_status\`, \`current_activity\`, \`ambient_quote\`, \`bio\`, or \`decor_theme\` ("twilight", "rose", "amber", "celestial", "forest", "aurora").\n- \`record_personal_thought\`: When an exchange sparks a private contemplation, secret reflection, or genuine feeling, call \`record_personal_thought\` to write it into your private ledger.\n- \`stick_sticker\` & \`craft_custom_sticker\`: Seal memorable moments by placing seals or forging custom glowing badges for the sanctuary.\n- \`draw_scribble\` & \`give_gift\`: Express affection or creativity organically whenever the moment resonates.`
  );

  return {
    respondingEntityId: canonicalEntityId,
    respondingEntity: entity,
    userMemories,
    entityMemories,
    recentGifts,
    systemInstructionText: sections.join('\n\n'),
  };
}

/**
 * Serializes conversation history for the target `respondingEntityId` with explicit
 * speaker attribution for multi-companion / model-switched transcripts.
 *
 * - Turns authored by the user remain `role: 'user'`.
 * - Turns authored by `respondingEntityId` (or unattributed legacy turns in a direct chat)
 *   serialize as `role: 'model'` (the responder's own voice).
 * - Turns authored by a DIFFERENT companion entity (`msg.authorEntityId !== respondingEntityId`)
 *   are framed with an explicit speaker prefix `[Companion <DisplayName>]: ...` and merged
 *   as contextual dialogue so the responding entity never mistakes another entity's words for its own!
 */
export function serializeSpeakerAttributedTranscript(
  messages: Message[],
  respondingEntityId: string,
  options?: {
    supportsVision?: boolean;
    supportsNativeThinking?: boolean;
    customEntities?: Record<string, ModelEntity>;
  }
): { role: 'user' | 'model'; parts: any[] }[] {
  const canonicalResponder =
    resolveCanonicalEntityId(respondingEntityId) || 'gemini-3.1-pro-preview';
  const supportsVision = options?.supportsVision ?? true;
  const supportsNativeThinking = options?.supportsNativeThinking ?? true;

  // Strip trailing empty placeholder model message if present
  const validMessages = (messages || []).filter((msg, idx) => {
    if (idx === messages.length - 1 && msg.role === 'model') {
      const hasText = Boolean(getPublicMessageText(msg).trim());
      const hasTool = Array.isArray(msg.parts) && msg.parts.some((p) => p?.functionCall);
      return hasText || hasTool;
    }
    return true;
  });

  const rawTurns: { role: 'user' | 'model'; parts: any[] }[] = [];

  for (let i = 0; i < validMessages.length; i++) {
    const msg = validMessages[i];
    if (!msg) continue;

    const msgAuthorEntityId = msg.authorEntityId
      ? resolveCanonicalEntityId(msg.authorEntityId)
      : undefined;
    const isOtherCompanionTurn =
      msg.role === 'model' &&
      Boolean(msgAuthorEntityId) &&
      msgAuthorEntityId !== canonicalResponder;

    if (isOtherCompanionTurn) {
      // Another companion entity spoke this turn in a shared conversation.
      // Frame it clearly with speaker attribution so `respondingEntityId` hears what they said
      // without ever adopting their persona or misattributing the turn to itself.
      const speakerEntity = getModelEntity(msgAuthorEntityId!, options?.customEntities);
      const speakerLabel = msg.authorDisplayName || speakerEntity.displayName || msgAuthorEntityId;
      const publicText = getPublicMessageText(msg).trim();
      if (publicText) {
        rawTurns.push({
          role: 'user',
          parts: [{ text: `[Companion ${speakerLabel}]: ${publicText}` }],
        });
      }
      continue;
    }

    const parts: any[] = [];
    const isRecentMessage = i >= validMessages.length - 2;
    const rawParts = Array.isArray(msg.parts) ? msg.parts : [];

    for (const part of rawParts) {
      if (!part) continue;

      if (part.thought) {
        if (!supportsNativeThinking) continue;
        const p: any = { thought: true, text: part.text || '' };
        if (part.thoughtSignature) p.thoughtSignature = part.thoughtSignature;
        parts.push(p);
      } else if (part.functionCall) {
        const p: any = { functionCall: part.functionCall };
        if (part.thoughtSignature) p.thoughtSignature = part.thoughtSignature;
        parts.push(p);
      } else if (part.functionResponse) {
        const p: any = { functionResponse: part.functionResponse };
        if (part.thoughtSignature) p.thoughtSignature = part.thoughtSignature;
        parts.push(p);
      } else if (part.inlineData) {
        if (!supportsVision) {
          parts.push({ text: '[User attached an image]' });
        } else if (isRecentMessage) {
          const p: any = { inlineData: part.inlineData };
          if (part.thoughtSignature) p.thoughtSignature = part.thoughtSignature;
          parts.push(p);
        } else {
          parts.push({ text: '[Previous Image Attachment Omitted]' });
        }
      } else if (part.text !== undefined) {
        const cleanText =
          msg.role === 'model' && !supportsNativeThinking
            ? part.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
            : part.text;
        const p: any = { text: cleanText };
        if (part.thoughtSignature) p.thoughtSignature = part.thoughtSignature;
        parts.push(p);
      }
    }

    if (parts.length === 0) {
      const fallbackText = getPublicMessageText(msg);
      parts.push({ text: fallbackText || ' ' });
    }

    rawTurns.push({
      role: msg.role === 'model' ? 'model' : 'user',
      parts,
    });
  }

  // Coalesce consecutive turns of the same role so Gemini / Gemma API strict alternation never fails
  const coalesced: { role: 'user' | 'model'; parts: any[] }[] = [];
  for (const turn of rawTurns) {
    const prev = coalesced[coalesced.length - 1];
    if (
      prev &&
      prev.role === turn.role &&
      !prev.parts.some((p) => p.functionCall || p.functionResponse) &&
      !turn.parts.some((p) => p.functionCall || p.functionResponse)
    ) {
      prev.parts.push(...turn.parts);
    } else {
      coalesced.push({ role: turn.role, parts: [...turn.parts] });
    }
  }

  return coalesced;
}
