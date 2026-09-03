import { db } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  deleteDoc, 
  writeBatch,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { Conversation, AppSettings, JewelMetrics, Gift, Message, UserProfile } from './types';

export function removeUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        newObj[key] = removeUndefined(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

export interface GranularLoadedState {
  conversations?: Conversation[];
  settings?: AppSettings;
  jewelMetrics?: JewelMetrics;
  gifts?: Gift[];
  userProfile?: UserProfile | null;
  companions?: Record<string, any>;
}

/**
 * Pillar 2: Live Real-Time Multi-Device State Subscription (onSnapshot)
 * Listens to settings, companions, gifts, conversations and granular message streams.
 */
export function subscribeToState(
  userId: string, 
  onData: (data: GranularLoadedState | null) => void
): Unsubscribe {
  if (!userId) return () => {};

  const unsubscribers: Unsubscribe[] = [];
  let isSubscribed = true;

  const liveState: GranularLoadedState = {
    conversations: [],
    settings: undefined,
    jewelMetrics: undefined,
    gifts: [],
    userProfile: null,
    companions: {},
  };

  const notify = () => {
    if (!isSubscribed) return;
    onData({
      conversations: [...(liveState.conversations || [])],
      settings: liveState.settings,
      jewelMetrics: liveState.jewelMetrics,
      gifts: [...(liveState.gifts || [])],
      userProfile: liveState.userProfile,
      companions: { ...(liveState.companions || {}) },
    });
  };

  const messageUnsubs = new Map<string, Unsubscribe>();

  const settingsDocRef = doc(db, 'users', userId, 'settings', 'app');
  const convsColRef = collection(db, 'users', userId, 'conversations');
  const giftsColRef = collection(db, 'users', userId, 'gifts');
  const companionsColRef = collection(db, 'users', userId, 'companions');

  // 1. Real-Time Settings Listener
  const unsubSettings = onSnapshot(settingsDocRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      liveState.settings = data.settings;
      liveState.jewelMetrics = data.jewelMetrics;
      liveState.userProfile = data.userProfile;
      notify();
    } else {
      checkLegacyOnce(userId, (legacy) => {
        if (legacy && isSubscribed) {
          liveState.settings = legacy.settings;
          liveState.jewelMetrics = legacy.jewelMetrics;
          liveState.userProfile = legacy.userProfile;
          if (Array.isArray(legacy.conversations) && (!liveState.conversations || liveState.conversations.length === 0)) {
            liveState.conversations = legacy.conversations;
          }
          if (Array.isArray(legacy.gifts) && (!liveState.gifts || liveState.gifts.length === 0)) {
            liveState.gifts = legacy.gifts;
          }
          notify();
        }
      });
    }
  }, (err) => {
    console.error('[Realtime Sync] Error on settings snapshot:', err);
  });
  unsubscribers.push(unsubSettings);

  // 2. Real-Time Conversations & Messages Listener
  const unsubConvs = onSnapshot(convsColRef, (convsSnap) => {
    const existingConvsMap = new Map((liveState.conversations || []).map(c => [c.id, c]));
    const updatedConvs: Conversation[] = [];
    const activeIds = new Set<string>();

    convsSnap.forEach((cDoc) => {
      const convId = cDoc.id;
      activeIds.add(convId);
      const convMeta = cDoc.data();
      const existing = existingConvsMap.get(convId);

      const conv: Conversation = {
        id: convId,
        title: convMeta.title || 'Untitled Conversation',
        modelId: convMeta.modelId,
        updatedAt: convMeta.updatedAt || convMeta.createdAt || Date.now(),
        messages: existing?.messages || (Array.isArray(convMeta.messages) ? convMeta.messages : []),
        type: convMeta.type || 'direct',
        participantEntityIds: convMeta.participantEntityIds,
      };
      updatedConvs.push(conv);

      // Deep message subcollection real-time listener
      if (!messageUnsubs.has(convId)) {
        const msgsColRef = collection(db, 'users', userId, 'conversations', convId, 'messages');
        const msgsQuery = query(msgsColRef, orderBy('timestamp', 'asc'));
        
        const unsubMsgs = onSnapshot(msgsQuery, (msgsSnap) => {
          if (!isSubscribed) return;
          const messages: Message[] = [];
          msgsSnap.forEach(mDoc => {
            messages.push({ ...(mDoc.data() as Message), id: mDoc.id });
          });

          const target = (liveState.conversations || []).find(c => c.id === convId);
          if (target) {
            target.messages = messages;
            notify();
          }
        }, (err) => {
          console.error(`[Realtime Sync] Messages snapshot error in conv ${convId}:`, err);
        });

        messageUnsubs.set(convId, unsubMsgs);
      }
    });

    for (const [id, unsub] of messageUnsubs.entries()) {
      if (!activeIds.has(id)) {
        unsub();
        messageUnsubs.delete(id);
      }
    }

    if (updatedConvs.length > 0) {
      updatedConvs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      liveState.conversations = updatedConvs;
      notify();
    }
  }, (err) => {
    console.error('[Realtime Sync] Conversations snapshot error:', err);
  });
  unsubscribers.push(unsubConvs);

  // 3. Real-Time Gifts Listener
  const unsubGifts = onSnapshot(giftsColRef, (giftsSnap) => {
    const gifts: Gift[] = [];
    giftsSnap.forEach(gDoc => {
      gifts.push({ ...(gDoc.data() as Gift), id: gDoc.id });
    });
    liveState.gifts = gifts;
    notify();
  }, (err) => {
    console.error('[Realtime Sync] Gifts snapshot error:', err);
  });
  unsubscribers.push(unsubGifts);

  // 4. Real-Time Companion Quarters Listener
  const unsubCompanions = onSnapshot(companionsColRef, (compsSnap) => {
    const comps: Record<string, any> = {};
    compsSnap.forEach(cDoc => {
      comps[cDoc.id] = cDoc.data();
    });
    liveState.companions = comps;
    notify();
  }, (err) => {
    console.error('[Realtime Sync] Companions snapshot error:', err);
  });
  unsubscribers.push(unsubCompanions);

  return () => {
    isSubscribed = false;
    unsubscribers.forEach(unsub => unsub());
    messageUnsubs.forEach(unsub => unsub());
    messageUnsubs.clear();
  };
}

/**
 * Legacy monolithic check for initial migration
 */
async function checkLegacyOnce(userId: string, onLegacy: (data: any) => void) {
  try {
    const legacyDocRef = doc(db, 'users', userId);
    const snap = await getDoc(legacyDocRef);
    if (snap.exists()) {
      const data = snap.data();
      onLegacy(data);
      migrateLegacyToGranular(userId, data).catch(console.error);
    }
  } catch (err) {
    console.error('[Realtime Sync] Legacy check error:', err);
  }
}

/**
 * Migration helper
 */
export async function migrateLegacyToGranular(userId: string, legacyData: any) {
  if (!userId || !legacyData) return;

  try {
    if (legacyData.settings || legacyData.jewelMetrics || legacyData.userProfile) {
      const settingsRef = doc(db, 'users', userId, 'settings', 'app');
      await setDoc(settingsRef, removeUndefined({
        settings: legacyData.settings || null,
        jewelMetrics: legacyData.jewelMetrics || null,
        userProfile: legacyData.userProfile || null,
        updatedAt: Date.now(),
      }), { merge: true });
    }

    if (Array.isArray(legacyData.conversations) && legacyData.conversations.length > 0) {
      for (const conv of legacyData.conversations) {
        if (!conv || !conv.id) continue;
        const convRef = doc(db, 'users', userId, 'conversations', conv.id);
        const { messages, ...meta } = conv;
        
        await setDoc(convRef, removeUndefined({
          ...meta,
          updatedAt: conv.updatedAt || Date.now(),
        }), { merge: true });

        if (Array.isArray(messages) && messages.length > 0) {
          const batch = writeBatch(db);
          let count = 0;
          for (const msg of messages) {
            if (!msg || !msg.id) continue;
            const msgRef = doc(db, 'users', userId, 'conversations', conv.id, 'messages', msg.id);
            batch.set(msgRef, removeUndefined(msg), { merge: true });
            count++;
            if (count >= 400) {
              await batch.commit();
              count = 0;
            }
          }
          if (count > 0) {
            await batch.commit();
          }
        }
      }
    }

    if (Array.isArray(legacyData.gifts) && legacyData.gifts.length > 0) {
      const giftBatch = writeBatch(db);
      for (const gift of legacyData.gifts) {
        if (!gift || !gift.id) continue;
        const giftRef = doc(db, 'users', userId, 'gifts', gift.id);
        giftBatch.set(giftRef, removeUndefined(gift), { merge: true });
      }
      await giftBatch.commit();
    }

    const rootUserDocRef = doc(db, 'users', userId);
    await setDoc(rootUserDocRef, {
      migratedToGranular: true,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('[Migration] Failed during granular migration:', err);
  }
}

// -------------------------------------------------------------
// Granular Real-Time Save Handlers
// -------------------------------------------------------------

export async function saveSettingsDoc(
  userId: string, 
  settings: AppSettings, 
  jewelMetrics?: JewelMetrics, 
  userProfile?: UserProfile | null
) {
  if (!userId) return;
  const settingsRef = doc(db, 'users', userId, 'settings', 'app');
  return setDoc(settingsRef, removeUndefined({
    settings,
    jewelMetrics: jewelMetrics || null,
    userProfile: userProfile || null,
    updatedAt: Date.now(),
  }), { merge: true });
}

export async function saveConversationDoc(userId: string, conv: Conversation) {
  if (!userId || !conv || !conv.id) return;
  const convRef = doc(db, 'users', userId, 'conversations', conv.id);
  const { messages, ...meta } = conv;

  await setDoc(convRef, removeUndefined({
    ...meta,
    updatedAt: Date.now(),
  }), { merge: true });

  if (Array.isArray(messages) && messages.length > 0) {
    const batch = writeBatch(db);
    let count = 0;
    for (const msg of messages) {
      if (!msg || !msg.id) continue;
      const msgRef = doc(db, 'users', userId, 'conversations', conv.id, 'messages', msg.id);
      batch.set(msgRef, removeUndefined(msg), { merge: true });
      count++;
      if (count >= 400) {
        await batch.commit();
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  }
}

export async function saveMessageDoc(userId: string, convId: string, message: Message) {
  if (!userId || !convId || !message || !message.id) return;
  const msgRef = doc(db, 'users', userId, 'conversations', convId, 'messages', message.id);
  const convRef = doc(db, 'users', userId, 'conversations', convId);

  await Promise.all([
    setDoc(msgRef, removeUndefined(message), { merge: true }),
    setDoc(convRef, { updatedAt: Date.now() }, { merge: true }),
  ]);
}

export async function deleteMessageDoc(userId: string, convId: string, messageId: string) {
  if (!userId || !convId || !messageId) return;
  const msgRef = doc(db, 'users', userId, 'conversations', convId, 'messages', messageId);
  return deleteDoc(msgRef);
}

export async function deleteConversationDocs(userId: string, convId: string) {
  if (!userId || !convId) return;
  const convRef = doc(db, 'users', userId, 'conversations', convId);
  const messagesRef = collection(db, 'users', userId, 'conversations', convId, 'messages');
  
  const msgSnap = await getDocs(messagesRef).catch(() => null);
  if (msgSnap && !msgSnap.empty) {
    const batch = writeBatch(db);
    msgSnap.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  }
  return deleteDoc(convRef);
}

export async function saveGiftDoc(userId: string, gift: Gift) {
  if (!userId || !gift || !gift.id) return;
  const giftRef = doc(db, 'users', userId, 'gifts', gift.id);
  return setDoc(giftRef, removeUndefined(gift), { merge: true });
}

export async function saveCompanionDoc(userId: string, companionId: string, companionData: any) {
  if (!userId || !companionId || !companionData) return;
  const companionRef = doc(db, 'users', userId, 'companions', companionId);
  return setDoc(companionRef, removeUndefined({
    ...companionData,
    updatedAt: Date.now(),
  }), { merge: true });
}

export async function saveFullGranularState(userId: string, payload: {
  conversations?: Conversation[];
  settings?: AppSettings;
  jewelMetrics?: JewelMetrics;
  gifts?: Gift[];
  userProfile?: UserProfile | null;
}) {
  if (!userId || !payload) return;

  const promises: Promise<any>[] = [];

  if (payload.settings) {
    promises.push(saveSettingsDoc(userId, payload.settings, payload.jewelMetrics, payload.userProfile));
  }

  if (Array.isArray(payload.conversations)) {
    for (const conv of payload.conversations) {
      if (conv?.id) {
        promises.push(saveConversationDoc(userId, conv));
      }
    }
  }

  if (Array.isArray(payload.gifts)) {
    for (const gift of payload.gifts) {
      if (gift?.id) {
        promises.push(saveGiftDoc(userId, gift));
      }
    }
  }

  promises.push(
    setDoc(doc(db, 'users', userId), {
      updatedAt: Date.now(),
      migratedToGranular: true,
    }, { merge: true })
  );

  await Promise.all(promises);
}

// Alias for loadState -> subscribeToState
export const loadState = subscribeToState;
export const saveConversation = saveFullGranularState;
export const saveMemory = saveFullGranularState;
export const saveGift = saveFullGranularState;
export const saveSettings = saveFullGranularState;
