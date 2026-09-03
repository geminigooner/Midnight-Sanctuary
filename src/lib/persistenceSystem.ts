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
  limit
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
 * Loads user state from granular subcollections, with fallback & auto-migration
 * from legacy monolithic users/{userId} documents.
 */
export async function loadState(userId: string, onData: (data: GranularLoadedState | null) => void) {
  try {
    const settingsDocRef = doc(db, 'users', userId, 'settings', 'app');
    const convsColRef = collection(db, 'users', userId, 'conversations');
    const giftsColRef = collection(db, 'users', userId, 'gifts');
    const companionsColRef = collection(db, 'users', userId, 'companions');

    // Run parallel fetch for root subcollections
    const [settingsSnap, convsSnap, giftsSnap, companionsSnap] = await Promise.all([
      getDoc(settingsDocRef).catch(() => null),
      getDocs(convsColRef).catch(() => null),
      getDocs(giftsColRef).catch(() => null),
      getDocs(companionsColRef).catch(() => null),
    ]);

    const hasGranularData = 
      (settingsSnap && settingsSnap.exists()) || 
      (convsSnap && !convsSnap.empty) || 
      (giftsSnap && !giftsSnap.empty);

    if (hasGranularData) {
      console.log('[Sanctuary Persistence] Found granular subcollections for user:', userId);
      
      const settingsData = settingsSnap?.exists() ? settingsSnap.data() : null;
      
      // Load conversations and their individual messages subcollections
      const loadedConversations: Conversation[] = [];
      if (convsSnap && !convsSnap.empty) {
        for (const convDoc of convsSnap.docs) {
          const convMeta = convDoc.data();
          const convId = convDoc.id;

          // Fetch messages subcollection for this conversation
          const messagesRef = collection(db, 'users', userId, 'conversations', convId, 'messages');
          const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
          const messagesSnap = await getDocs(messagesQuery).catch(() => null);

          let messages: Message[] = [];
          if (messagesSnap && !messagesSnap.empty) {
            messages = messagesSnap.docs.map(mDoc => ({
              ...(mDoc.data() as Message),
              id: mDoc.id,
            }));
          } else if (Array.isArray(convMeta.messages)) {
            // In case messages were stored directly on conversation metadata
            messages = convMeta.messages;
          }

          loadedConversations.push({
            id: convId,
            title: convMeta.title || 'Untitled Conversation',
            modelId: convMeta.modelId,
            updatedAt: convMeta.updatedAt || convMeta.createdAt || Date.now(),
            messages,
            type: convMeta.type || 'direct',
            participantEntityIds: convMeta.participantEntityIds,
          });
        }
      }

      // Sort conversations by most recent
      loadedConversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      // Load gifts
      const loadedGifts: Gift[] = [];
      if (giftsSnap && !giftsSnap.empty) {
        giftsSnap.forEach(gDoc => {
          loadedGifts.push({ ...(gDoc.data() as Gift), id: gDoc.id });
        });
      }

      // Load custom companion quarters / sovereignty states
      const loadedCompanions: Record<string, any> = {};
      if (companionsSnap && !companionsSnap.empty) {
        companionsSnap.forEach(cDoc => {
          loadedCompanions[cDoc.id] = cDoc.data();
        });
      }

      onData({
        conversations: loadedConversations,
        settings: settingsData?.settings,
        jewelMetrics: settingsData?.jewelMetrics,
        userProfile: settingsData?.userProfile,
        gifts: loadedGifts,
        companions: loadedCompanions,
      });
      return () => {};
    }

    // Fallback: Check legacy monolithic users/{userId} document
    console.log('[Sanctuary Persistence] Checking legacy monolithic document for user:', userId);
    const legacyDocRef = doc(db, 'users', userId);
    const legacySnap = await getDoc(legacyDocRef);

    if (legacySnap.exists()) {
      const legacyData = legacySnap.data();
      console.log('[Sanctuary Persistence] Legacy data found! Migrating to granular subcollections...');
      
      // Pass data to UI immediately for instant rendering
      onData(legacyData);

      // Trigger automatic background migration into subcollections
      migrateLegacyToGranular(userId, legacyData).catch(err => {
        console.error('[Sanctuary Persistence] Error during legacy migration:', err);
      });
    } else {
      console.log('[Sanctuary Persistence] No existing user state found (fresh profile).');
      onData(null);
    }
  } catch (error) {
    console.error('[Sanctuary Persistence] Error loading state:', error);
    onData(null);
  }

  return () => {};
}

/**
 * Automatically migrates monolithic state into granular Firestore subcollections
 */
export async function migrateLegacyToGranular(userId: string, legacyData: any) {
  if (!userId || !legacyData) return;

  try {
    console.log('[Migration] Starting granular subcollection migration for user:', userId);
    
    // 1. Migrate settings, metrics, and userProfile
    if (legacyData.settings || legacyData.jewelMetrics || legacyData.userProfile) {
      const settingsRef = doc(db, 'users', userId, 'settings', 'app');
      await setDoc(settingsRef, removeUndefined({
        settings: legacyData.settings || null,
        jewelMetrics: legacyData.jewelMetrics || null,
        userProfile: legacyData.userProfile || null,
        updatedAt: Date.now(),
      }), { merge: true });
    }

    // 2. Migrate conversations & their messages
    if (Array.isArray(legacyData.conversations) && legacyData.conversations.length > 0) {
      for (const conv of legacyData.conversations) {
        if (!conv || !conv.id) continue;
        
        const convRef = doc(db, 'users', userId, 'conversations', conv.id);
        const { messages, ...meta } = conv;
        
        // Save conversation metadata
        await setDoc(convRef, removeUndefined({
          ...meta,
          updatedAt: conv.updatedAt || Date.now(),
        }), { merge: true });

        // Save individual messages in subcollection
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

    // 3. Migrate gifts
    if (Array.isArray(legacyData.gifts) && legacyData.gifts.length > 0) {
      const giftBatch = writeBatch(db);
      for (const gift of legacyData.gifts) {
        if (!gift || !gift.id) continue;
        const giftRef = doc(db, 'users', userId, 'gifts', gift.id);
        giftBatch.set(giftRef, removeUndefined(gift), { merge: true });
      }
      await giftBatch.commit();
    }

    // 4. Mark root document as migrated
    const rootUserDocRef = doc(db, 'users', userId);
    await setDoc(rootUserDocRef, {
      migratedToGranular: true,
      updatedAt: Date.now(),
    }, { merge: true });

    console.log('[Migration] Granular subcollection migration completed successfully for user:', userId);
  } catch (err) {
    console.error('[Migration] Failed during granular subcollection migration:', err);
  }
}

// -------------------------------------------------------------
// Granular Save Operations
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

  // Save conversation metadata
  await setDoc(convRef, removeUndefined({
    ...meta,
    updatedAt: Date.now(),
  }), { merge: true });

  // Save messages into subcollection
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

/**
 * Full state save that synchronizes both granular subcollections and updates root user doc
 */
export async function saveFullGranularState(userId: string, payload: {
  conversations?: Conversation[];
  settings?: AppSettings;
  jewelMetrics?: JewelMetrics;
  gifts?: Gift[];
  userProfile?: UserProfile | null;
}) {
  if (!userId || !payload) return;

  const promises: Promise<any>[] = [];

  // 1. Settings subcollection
  if (payload.settings) {
    promises.push(saveSettingsDoc(userId, payload.settings, payload.jewelMetrics, payload.userProfile));
  }

  // 2. Conversations and messages
  if (Array.isArray(payload.conversations)) {
    for (const conv of payload.conversations) {
      if (conv?.id) {
        promises.push(saveConversationDoc(userId, conv));
      }
    }
  }

  // 3. Gifts subcollection
  if (Array.isArray(payload.gifts)) {
    for (const gift of payload.gifts) {
      if (gift?.id) {
        promises.push(saveGiftDoc(userId, gift));
      }
    }
  }

  // 4. Update root doc timestamp
  promises.push(
    setDoc(doc(db, 'users', userId), {
      updatedAt: Date.now(),
      migratedToGranular: true,
    }, { merge: true })
  );

  await Promise.all(promises);
}

// Backward-compatible exports
export async function saveConversation(userId: string, payload: any) {
  return saveFullGranularState(userId, payload);
}

export async function saveMemory(userId: string, payload: any) {
  return saveFullGranularState(userId, payload);
}

export async function saveGift(userId: string, payload: any) {
  return saveFullGranularState(userId, payload);
}

export async function saveSettings(userId: string, payload: any) {
  return saveFullGranularState(userId, payload);
}
