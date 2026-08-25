import { useState, useEffect, useCallback } from 'react';
import { Conversation, AppSettings, DEFAULT_SETTINGS, JewelMetrics, DEFAULT_JEWEL_METRICS, ModelInfo, Gift, Message, UserProfile } from './types';
import { v4 as uuidv4 } from 'uuid';
import { db, auth, signOut } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

function removeUndefined(obj: any): any {
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

export function useAppStore(user: any) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [jewelMetrics, setJewelMetrics] = useState<JewelMetrics>(DEFAULT_JEWEL_METRICS);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);


  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    
    let isInitialLoad = true;
    
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (isInitialLoad) {
          if (data.conversations) {
            const parsed = data.conversations;
            const filtered = parsed.map((c: any) => ({
              ...c,
              messages: c.messages || []
            }));
            setConversations(filtered);
          }
          if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
          if (data.jewelMetrics) setJewelMetrics({ ...DEFAULT_JEWEL_METRICS, ...data.jewelMetrics });
          if (data.gifts) setGifts(data.gifts);
          if (data.userProfile) setProfile(data.userProfile);
          
          console.log('LOADING DATA from firestore, conversations count:', data.conversations ? data.conversations.length : 0);
          setDataLoaded(true);
          isInitialLoad = false;
        }
      } else {
        // Doc doesn't exist, this is first time
        if (isInitialLoad) {
          setDataLoaded(true);
          isInitialLoad = false;
        }
      }
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token: string) => {
      fetch('/api/models', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(async res => {
        if (res.status === 401) {
          signOut(auth);
          throw new Error("Unauthorized");
        }
        const text = await res.text();
        if (text.includes('<!DOCTYPE html>')) {
          console.error('Server returned HTML instead of JSON for models');
          return [];
        }
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse models JSON');
          return [];
        }
      })
      .then((data: ModelInfo[]) => {
        setAvailableModels(Array.isArray(data) ? data : []);
        setIsModelsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch models", err);
        setIsModelsLoading(false);
      });
    }).catch((err: any) => {
      console.error("Failed to get ID token", err);
      setIsModelsLoading(false);
    });
  }, [user]);

  // Save on change
  useEffect(() => {
    if (!dataLoaded || !user) return;
    const t = setTimeout(async () => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const payload: any = {
          conversations,
          settings,
          jewelMetrics,
          gifts
        };
        if (profile) payload.userProfile = profile;
        
        // --- DIAGNOSTICS ---
        const payloadSize = JSON.stringify(payload).length;
        console.log(`[Diagnostic] Attempting Firestore save... Payload size approx: ${(payloadSize / 1024).toFixed(2)} KB`);
        
        if (conversations.length > 0) {
          const sortedConvs = [...conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          const mostRecentConv = sortedConvs[0];
          const lastMsg = mostRecentConv?.messages?.[mostRecentConv.messages.length - 1];
          if (lastMsg) {
            console.log(`[Diagnostic] Final message in active conv reaches save path -> Role: ${lastMsg.role}, text length: ${lastMsg.publicText?.length || lastMsg.parts?.[0]?.text?.length || 0}`);
          }
        }
        
        await setDoc(userDocRef, removeUndefined(payload), { merge: true });
        console.log('[Diagnostic] Save SUCCESS! Data correctly committed to Firestore.');
      } catch (e) {
        console.error('[Diagnostic] Save FAILURE! Actual Firestore Error:', e);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [conversations, settings, jewelMetrics, gifts, profile, dataLoaded, user]);
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      // Model changing no longer clears the current chat.
      
      return updated;
    });
  }, []);

  const addGift = useCallback((gift: Omit<Gift, 'id' | 'timestamp'>) => {
    const newGift: Gift = {
      ...gift,
      id: uuidv4(),
      timestamp: Date.now()
    };
    setGifts(prev => [newGift, ...prev]);
  }, []);

  const removeMemory = useCallback((id: string) => {
    setSettings(prev => ({
      ...prev,
      memories: (prev.memories || []).filter(m => m.id !== id)
    }));
  }, []);

  const addMemory = useCallback((memoryContent: string, origin?: string, author?: 'user'|'model', modelId?: string, caption?: string) => {
    setSettings(prev => {
      const newMemory = {
        id: uuidv4(),
        content: memoryContent,
        createdAt: Date.now(),
        origin,
        author,
        modelId,
        caption
      };
      const nextSettings = {
        ...prev,
        memories: [newMemory, ...(prev.memories || [])]
      };
      if (user) {
        setDoc(doc(db, 'users', user.uid), removeUndefined({ settings: nextSettings }), { merge: true })
          .catch(e => console.error('[Diagnostic] Immediate Save FAILURE (addMemory):', e));
      }
      return nextSettings;
    });
  }, [user]);

  const addEventLog = useCallback((description: string) => {
    setSettings(prev => {
      const newEvent = {
        id: uuidv4(),
        description,
        timestamp: Date.now()
      };
      return {
        ...prev,
        eventLog: [newEvent, ...(prev.eventLog || [])]
      };
    });
  }, []);

  const createConversation = useCallback(() => {
    const newConvo: Conversation = {
      id: uuidv4(),
      title: 'New Conversation',
      messages: [],
      modelId: settings.model, // Bind chat to current model
      updatedAt: Date.now()
    };
    setConversations(prev => [newConvo, ...prev]);
    setCurrentId(newConvo.id);
    return newConvo;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentId === id) setCurrentId(null);
  }, [currentId]);

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title, updatedAt: Date.now() } : c));
  }, []);

  const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        if (updates.messages && updates.messages.length === 0 && c.messages && c.messages.length > 0) {
          console.warn("Blocked attempt to clear messages in updateConversation");
          const safeUpdates = { ...updates };
          delete safeUpdates.messages;
          return { ...c, ...safeUpdates, updatedAt: Date.now() };
        }
        return { ...c, ...updates, updatedAt: Date.now() };
      }
      return c;
    }));
  }, []);

  const addMessage = useCallback((conversationId: string, message: Message) => {
    setConversations(prev => {
      const next = prev.map(c => 
        c.id === conversationId ? { ...c, messages: [...(c.messages || []), message], updatedAt: Date.now() } : c
      );
      if (user) {
        setDoc(doc(db, 'users', user.uid), removeUndefined({ conversations: next }), { merge: true })
          .catch(e => console.error('[Diagnostic] Immediate Save FAILURE (addMessage):', e));
      }
      return next;
    });
  }, [user]);

  const updateMessage = useCallback((conversationId: string, messageId: string, updates: Partial<Message>) => {
    setConversations(prev => {
      const next = prev.map(c => 
        c.id === conversationId ? { 
          ...c, 
          messages: (c.messages || []).map(m => {
            if (m.id === messageId) {
              const safeUpdates = { ...updates };
              if (safeUpdates.parts && safeUpdates.parts.length === 0) {
                safeUpdates.parts = [{ text: '' }];
              }
              return { ...m, ...safeUpdates };
            }
            return m;
          }),
          updatedAt: Date.now() 
        } : c
      );
      if (user && updates.status === 'complete') {
        setDoc(doc(db, 'users', user.uid), removeUndefined({ conversations: next }), { merge: true })
          .catch(e => console.error('[Diagnostic] Immediate Save FAILURE (updateMessage):', e));
      }
      return next;
    });
  }, [user]);

  const removeMessage = useCallback((conversationId: string, messageId: string) => {
    setConversations(prev => prev.map(c => 
      c.id === conversationId ? { 
        ...c, 
        messages: c.messages.filter(m => m.id !== messageId),
        updatedAt: Date.now() 
      } : c
    ));
  }, []);

  const updateJewelMetrics = useCallback((updates: Partial<JewelMetrics> | ((prev: JewelMetrics) => JewelMetrics)) => {
    setJewelMetrics(prev => typeof updates === 'function' ? updates(prev) : { ...prev, ...updates });
  }, []);

  const resetJewel = useCallback(() => {
    setJewelMetrics(DEFAULT_JEWEL_METRICS);
  }, []);

  return {
    conversations,
    currentId,
    setCurrentId,
    settings,
    updateSettings,
    jewelMetrics,
    updateJewelMetrics,
    resetJewel,
    createConversation,
    deleteConversation,
    renameConversation,
    updateConversation,
    addMessage,
    updateMessage,
    removeMessage,
    availableModels,
    isModelsLoading,
    gifts,
    addGift,
    addMemory,
    removeMemory,
    addEventLog,
    profile,
    updateProfile: (newProfile: UserProfile) => setProfile(newProfile),
    addGemmaNote: (note: string) => setProfile(prev => prev ? { ...prev, gemmaNotes: [{ text: note, timestamp: Date.now() }, ...(prev.gemmaNotes || [])] } : { name: 'User', gemmaNotes: [{ text: note, timestamp: Date.now() }] }),
  };
}
