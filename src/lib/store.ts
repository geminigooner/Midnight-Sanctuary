import { useState, useEffect, useCallback } from 'react';
import { Conversation, AppSettings, DEFAULT_SETTINGS, JewelMetrics, DEFAULT_JEWEL_METRICS, ModelInfo, Gift, Message, UserProfile } from './types';
import { v4 as uuidv4 } from 'uuid';
import { db, auth, signOut, onAuthStateChanged } from './firebase';
import { loadState, saveConversation, saveSettings, saveMemory, saveGift } from './persistenceSystem';
import { normalizeModelId } from './modelSystem';

export function useAppStore(passedUser?: any) {
  const [authUser, setAuthUser] = useState<any>(passedUser || null);

  useEffect(() => {
    if (passedUser !== undefined) {
      setAuthUser(passedUser);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
    });
    return () => unsubscribe();
  }, [passedUser]);

  const user = authUser;
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
    let isInitialLoad = true;
    
    const unsubscribe = loadState(user.uid, (data) => {
      if (data) {
        if (isInitialLoad) {
          if (data.conversations) {
            const parsed = data.conversations;
            const filtered = parsed.map((c: any) => ({
              ...c,
              messages: c.messages || []
            }));
            setConversations(filtered);
            if (filtered.length > 0) {
              setCurrentId((prev) => prev || filtered[0].id);
            }
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
        if (isInitialLoad) {
          setDataLoaded(true);
          isInitialLoad = false;
        }
      }
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
        console.log('[Diagnostic] Debounced Auto-Save Triggered for User:', user.uid);
        
        // Strip undefined values across the state hierarchy to ensure strictly valid Firestore JSON
        const sanitizeForFirestore = (obj: any): any => {
          if (Array.isArray(obj)) {
            return obj.map(sanitizeForFirestore);
          } else if (obj !== null && typeof obj === 'object') {
            return Object.entries(obj).reduce((acc: any, [k, v]) => {
              if (v !== undefined) {
                acc[k] = sanitizeForFirestore(v);
              }
              return acc;
            }, {});
          }
          return obj;
        };

        const payload = sanitizeForFirestore({
          conversations,
          settings,
          jewelMetrics,
          gifts,
          userProfile: profile
        });

        // Diagnostic tracing for user and model messages
        if (conversations.length > 0) {
          const activeConv = conversations.find(c => c.id === currentId) || conversations[0];
          if (activeConv && activeConv.messages && activeConv.messages.length > 0) {
            const lastMsg = activeConv.messages[activeConv.messages.length - 1];
            console.log(`[Diagnostic] Final message in active conv reaches save path -> Role: ${lastMsg.role}, text length: ${lastMsg.publicText?.length || lastMsg.parts?.[0]?.text?.length || 0}`);
          }
        }
        
        // Use saveSettings as the main debounced save for the full payload
        await saveSettings(user.uid, payload);
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
      return updated;
    });
  }, []);

  const addGift = useCallback((gift: Omit<Gift, 'id' | 'timestamp'>) => {
    const newGift: Gift = {
      ...gift,
      id: uuidv4(),
      modelId: gift.modelId ? normalizeModelId(gift.modelId) : undefined,
      targetModelId: gift.targetModelId ? normalizeModelId(gift.targetModelId) : undefined,
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
        origin: origin || 'direct_input',
        author: author || 'user',
        modelId: modelId ? normalizeModelId(modelId) : undefined,
        caption: caption
      };
      
      const prevMemories = prev.memories || [];
      const isDuplicate = prevMemories.some(m => m.content.toLowerCase().trim() === memoryContent.toLowerCase().trim());
      if (isDuplicate) return prev;

      return {
        ...prev,
        memories: [newMemory, ...prevMemories]
      };
    });
  }, []);

  const addEventLog = useCallback((description: string) => {
    setSettings(prev => {
      const newEvent = {
        id: uuidv4(),
        description,
        timestamp: Date.now()
      };
      return {
        ...prev,
        eventLog: [newEvent, ...(prev.eventLog || [])].slice(0, 10)
      };
    });
  }, []);

  const createConversation = useCallback(() => {
    const newId = uuidv4();
    const newConv: Conversation = {
      id: newId,
      title: 'New Sanctuary',
      messages: [],
      modelId: settings.model,
      updatedAt: Date.now()
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentId(newId);
    return newConv;
  }, [settings.model]);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (currentId === id) {
        setCurrentId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  }, [currentId]);

  const renameConversation = useCallback((id: string, newTitle: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c));
  }, []);

  const updateConversation = useCallback((id: string, updates: Partial<Conversation>) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c));
  }, []);

  const addMessage = useCallback((conversationId: string, message: Message) => {
    setConversations(prev => {
      let targetFound = false;
      const next = prev.map(c => {
        if (c.id === conversationId) {
          targetFound = true;
          const currentMsgs = c.messages || [];
          const existingIndex = currentMsgs.findIndex(m => m.id === message.id);
          let newMsgs: Message[];
          if (existingIndex >= 0) {
            newMsgs = [...currentMsgs];
            newMsgs[existingIndex] = message;
          } else {
            newMsgs = [...currentMsgs, message];
          }
          return {
            ...c,
            messages: newMsgs,
            updatedAt: Date.now()
          };
        }
        return c;
      });

      if (!targetFound) {
        const newConv: Conversation = {
          id: conversationId,
          title: message.parts?.[0]?.text?.slice(0, 30) || 'New Sanctuary',
          messages: [message],
          modelId: settings.model,
          updatedAt: Date.now()
        };
        next.unshift(newConv);
      }

      if (user) {
        saveConversation(user.uid, { conversations: next })
          .catch(e => console.error('[Diagnostic] Immediate Save FAILURE (addMessage):', e));
      }

      return next;
    });
  }, [user, settings.model]);

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
      if (user && updates.thoughtStatus === 'complete') {
        saveConversation(user.uid, { conversations: next })
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
    user,
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
