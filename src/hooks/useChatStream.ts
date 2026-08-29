import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';
import { Conversation, Message, AppSettings, JewelMetrics, Gift as GiftType, UserProfile, getPublicMessageText } from '../lib/types';
import { streamChat } from '../lib/gemini';
import { PresenceState } from '../components/Presence';
import { triggerHaptic } from '../lib/haptics';

export interface UseChatStreamOptions {
  conversation: Conversation | undefined;
  settings: AppSettings;
  gifts: GiftType[];
  profile: UserProfile | null;
  jewelMetrics: JewelMetrics;
  onUpdate: (id: string, updates: Partial<Conversation>) => void;
  onAddMessage: (conversationId: string, message: Message) => void;
  onUpdateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  onUpdateJewel: (updates: Partial<JewelMetrics> | ((prev: JewelMetrics) => JewelMetrics)) => void;
  onAddGift: (gift: any) => void;
  onAddMemory: (content: string, origin?: string, author?: 'user' | 'model', modelId?: string, caption?: string, isLocked?: boolean, lockReason?: string) => void;
  onAddEventLog: (description: string) => void;
  onAddGemmaNote: (note: string) => void;
  onUpdateEntityQuarters?: (modelKey: string, updates: any) => void;
  onRecordEntityThought?: (modelKey: string, thoughtText: string) => void;
}

export function useChatStream({
  conversation,
  settings,
  gifts,
  profile,
  jewelMetrics,
  onUpdate,
  onAddMessage,
  onUpdateMessage,
  onUpdateJewel,
  onAddGift,
  onAddMemory,
  onAddEventLog,
  onAddGemmaNote,
  onUpdateEntityQuarters,
  onRecordEntityThought,
}: UseChatStreamOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [presence, setPresence] = useState<PresenceState>('resting');
  const [isScanningProfile, setIsScanningProfile] = useState(false);

  const isGeneratingRef = useRef(false);
  const conversationRef = useRef(conversation);
  const abortControllerRef = useRef<AbortController | null>(null);
  const watchdogTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeGenerationConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  const setTemporaryPresence = useCallback((newState: PresenceState, revertTo: PresenceState, delay: number = 3000) => {
    setPresence(newState);
    if (presenceTimeoutRef.current) clearTimeout(presenceTimeoutRef.current);
    presenceTimeoutRef.current = setTimeout(() => {
      setPresence(revertTo);
    }, delay);
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (presenceTimeoutRef.current) clearTimeout(presenceTimeoutRef.current);
      if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
    };
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      activeGenerationConversationIdRef.current = null;
      if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
      setTemporaryPresence('complete', 'resting');
    }
  }, [setTemporaryPresence]);

  const sendMessage = useCallback(async (
    textToAnalyse: string = '',
    options?: {
      replaceIndex?: number;
      additionalMessages?: Message[];
      attachments?: { mimeType: string; data: string; previewUrl?: string }[];
    }
  ) => {
    const requestConversationId = conversationRef.current?.id;

    if (!requestConversationId) {
      console.warn("sendMessage blocked: No active conversation.");
      return;
    }

    const { replaceIndex, additionalMessages, attachments = [] } = options || {};

    if ((isGenerating || isGeneratingRef.current) && (!additionalMessages || additionalMessages.length === 0)) {
      console.warn("sendMessage blocked: Generation already in progress.");
      triggerHaptic('heavy');
      if (typeof window !== 'undefined') {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-1/4 left-1/2 -translate-x-1/2 bg-rose text-white px-4 py-2 rounded-xl shadow-lg z-[9999] animate-in fade-in slide-in-from-top-4 duration-300';
        errorDiv.innerText = "Model is still thinking...";
        document.body.appendChild(errorDiv);
        setTimeout(() => {
          errorDiv.classList.add('animate-out', 'fade-out', 'slide-out-to-top-4');
          setTimeout(() => errorDiv.remove(), 300);
        }, 2000);
      }
      return;
    }

    if (!textToAnalyse.trim() && attachments.length === 0 && (!additionalMessages || additionalMessages.length === 0)) {
      return;
    }

    triggerHaptic('light');

    const now = Date.now();
    onUpdateJewel(prev => {
      let rapid = prev.rapidExchanges;
      let long = prev.longPauses;
      if (prev.lastInteractionTimestamp > 0) {
        const diff = now - prev.lastInteractionTimestamp;
        if (diff < 10000) rapid++;
        else if (diff > 3600000) long++;
      }
      return {
        ...prev,
        totalMessages: prev.totalMessages + 1,
        rapidExchanges: rapid,
        longPauses: long,
        lastInteractionTimestamp: now
      };
    });

    let currentMessages = [...(conversationRef.current?.messages || [])];
    
    if (replaceIndex !== undefined && replaceIndex > 0) {
      currentMessages = currentMessages.slice(0, replaceIndex);
      onUpdate(requestConversationId, { messages: currentMessages });
    } else if (replaceIndex === 0) {
      console.warn("sendMessage blocked replaceIndex=0 to prevent clearing chat");
    }
    
    const parts: any[] = [];
    if (textToAnalyse.trim()) parts.push({ text: textToAnalyse });
    attachments.forEach(a => parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } }));
    
    if (!additionalMessages || additionalMessages.length === 0) {
      const userMsg: Message = { id: uuidv4(), role: 'user', parts, timestamp: now };
      currentMessages.push(userMsg);
      onAddMessage(requestConversationId, userMsg);
    } else {
      currentMessages.push(...additionalMessages);
      additionalMessages.forEach(msg => onAddMessage(requestConversationId, msg));
    }
    if (currentMessages.length === 1 && textToAnalyse.trim()) {
      onUpdate(requestConversationId, { title: textToAnalyse.slice(0, 30) });
    }

    setIsGenerating(true);
    setPresence('deep_thinking');
    abortControllerRef.current = new AbortController();
    activeGenerationConversationIdRef.current = requestConversationId;
    
    let modelMsgId = uuidv4();
    let currentModelText = '';
    let currentModelThought = '';
    let currentModelApiParts: any[] = [];
    let currentModelFinishReason: string | undefined;
    let currentModelBackend: string | undefined;
    let isFirstChunk = true;

    const resetIdleTimeout = () => {
      if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
      const isGemini3 = settings.model.includes('gemini-3');
      const timeoutMs = isGemini3 ? 240000 : 90000;
      watchdogTimeoutRef.current = setTimeout(() => {
        console.warn("Idle timeout triggered. Aborting stuck stream.");
        if (abortControllerRef.current) abortControllerRef.current.abort();
      }, timeoutMs); 
    };
    resetIdleTimeout();

    const updateModelMessage = (text: string, thought: string, status: 'thinking' | 'complete' | 'error') => {
      const partsToSave: any[] = [];
      if (thought) {
        partsToSave.push({
          thought: true,
          text: thought,
        });
      }
      if (text) {
        partsToSave.push({
          text,
        });
      }
      const functionCalls = currentModelApiParts.filter(p => p.functionCall);
      partsToSave.push(...functionCalls);

      if (partsToSave.length === 0) {
        partsToSave.push({ text: '' });
      }

      onUpdateMessage(requestConversationId, modelMsgId, {
        parts: partsToSave,
        publicText: text,
        thoughtText: thought,
        thoughtStatus: status,
        finishReason: currentModelFinishReason,
        backend: currentModelBackend,
      });
    };

    try {
      let hasToolCalls = false;
      const generator = streamChat(currentMessages, settings, gifts, profile, abortControllerRef.current.signal);
      
      onAddMessage(requestConversationId, { 
        id: modelMsgId, 
        role: 'model', 
        parts: [{ text: '' }],
        publicText: '',
        thoughtText: '',
        thoughtStatus: settings.model.includes('gemma') || settings.model.includes('gemini-3') ? 'thinking' : 'complete',
        timestamp: Date.now() 
      });

      let rawTextAccumulator = '';
      let apiThoughtAccumulator = '';
      let hasClientFulfillmentRef = false;
      let lastUpdateTime = 0;

      const updateWithParsedThinking = (textChunk: string, force = false) => {
         if (textChunk) rawTextAccumulator += textChunk;
         
         let parsedThought = apiThoughtAccumulator;
         let parsedText = rawTextAccumulator;
         let status = 'complete';
         
         let currentText = rawTextAccumulator;
         const extractedThoughts: string[] = [];
         
         while (true) {
             const startIndex = currentText.indexOf('<think>');
             if (startIndex === -1) break;
             
             const endIndex = currentText.indexOf('</think>', startIndex);
             if (endIndex !== -1) {
                 extractedThoughts.push(currentText.substring(startIndex + 7, endIndex));
                 currentText = currentText.substring(0, startIndex) + currentText.substring(endIndex + 8);
             } else {
                 extractedThoughts.push(currentText.substring(startIndex + 7));
                 currentText = currentText.substring(0, startIndex);
                 status = 'thinking';
                 break;
             }
         }
         
         if (extractedThoughts.length > 0) {
             parsedThought = (apiThoughtAccumulator ? apiThoughtAccumulator + '\n' : '') + extractedThoughts.join('\n\n');
         }
         parsedText = currentText;
         
         currentModelText = parsedText.trimStart();
         currentModelThought = parsedThought.trimStart();
         
         const nowTime = Date.now();
         if (force || nowTime - lastUpdateTime > 50) {
           updateModelMessage(currentModelText, currentModelThought, status as any);
           lastUpdateTime = nowTime;
         }
      };

      for await (const chunk of generator) {
        resetIdleTimeout();
        if (typeof chunk === 'string') {
          if (isFirstChunk) { setPresence('responding'); isFirstChunk = false; }
          updateWithParsedThinking(chunk);
        } else if (chunk && typeof chunk === 'object') {
          if (chunk.type === 'thought') {
            apiThoughtAccumulator += chunk.text;
            updateWithParsedThinking('', true);
            updateModelMessage(currentModelText, currentModelThought, 'thinking');
          } else if (chunk.type === 'text') {
            if (isFirstChunk) { setPresence('responding'); isFirstChunk = false; }
            updateWithParsedThinking(chunk.text);
          } else if (chunk.type === 'gift') {
            hasToolCalls = true;
            onAddGift({
              from: 'model',
              modelId: settings.model,
              content: chunk.content,
              gift_type: chunk.gift_type,
              reason: chunk.reason
            });
          } else if (chunk.type === 'memory') {
            hasToolCalls = true;
            onAddMemory(chunk.content, 'model_initiated', (chunk as any).author || 'model', (chunk as any).modelId || settings.model, (chunk as any).caption);
          } else if (chunk.type === 'lock_memory') {
            hasToolCalls = true;
            onAddMemory(chunk.content, 'model_locked', (chunk as any).author || 'model', (chunk as any).modelId || settings.model, undefined, true, chunk.lock_reason);
          } else if (chunk.type === 'update_quarters') {
            hasToolCalls = true;
            if (onUpdateEntityQuarters) {
              onUpdateEntityQuarters(chunk.modelId || settings.model, {
                bio: chunk.bio,
                moodStatus: chunk.mood_status,
                currentActivity: chunk.current_activity,
                ambientQuote: chunk.ambient_quote,
                tagline: chunk.tagline,
                decorTheme: chunk.decor_theme,
              });
            }
          } else if (chunk.type === 'record_thought') {
            hasToolCalls = true;
            if (onRecordEntityThought) {
              onRecordEntityThought(chunk.modelId || settings.model, chunk.thought);
            }
          } else if (chunk.type === 'user_note') {
            hasToolCalls = true;
            onAddGemmaNote(chunk.note);
          } else if (chunk.type === 'eventLog') {
            hasToolCalls = true;
            onAddEventLog(chunk.description);
          } else if (chunk.type === 'client_tool_call') {
            hasToolCalls = true;
            hasClientFulfillmentRef = true;
            const element = document.getElementById('capture-profile-view');
            if (element) {
               try {
                 const canvas = await html2canvas(element, { backgroundColor: null });
                 const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                 const base64Data = dataUrl.split(',')[1];
                 
                 const functionResponseMsg = {
                    id: Math.random().toString(36).substring(2, 9),
                    role: 'user',
                    parts: [
                       {
                          functionResponse: {
                             name: chunk.name,
                             id: chunk.callId,
                             response: {
                                result: "The profile image is attached to this message."
                             }
                          }
                       },
                       {
                          inlineData: { mimeType: 'image/jpeg', data: base64Data }
                       }
                    ],
                    timestamp: Date.now()
                 };
                 setIsScanningProfile(true);
                 setTimeout(() => {
                   setIsScanningProfile(false);
                   sendMessage('', { additionalMessages: [functionResponseMsg as any] });
                 }, 1500);
               } catch (e) {
                 console.error("Failed to capture profile view", e);
               }
            } else {
                 const functionResponseMsg = {
                    id: Math.random().toString(36).substring(2, 9),
                    role: 'user',
                    parts: [{
                       functionResponse: {
                          name: chunk.name,
                          id: chunk.callId,
                          response: {
                             result: "The visual profile view cannot be captured right now or the selected model does not support vision."
                          }
                       }
                    }],
                    timestamp: Date.now()
                 };
                 sendMessage('', { additionalMessages: [functionResponseMsg as any] });
            }
          } else if (chunk.type === 'model_parts') {
            currentModelApiParts = chunk.parts;
            updateModelMessage(
              currentModelText,
              currentModelThought,
              'complete'
            );
          } else if (chunk.type === 'history_append') {
            const msgs = chunk.messages;
            currentModelApiParts = msgs[0].parts;
            onUpdateMessage(requestConversationId, modelMsgId, {
              parts: currentModelApiParts,
              thoughtText: currentModelThought,
              publicText: currentModelText,
              thoughtStatus: 'complete',
              finishReason: currentModelFinishReason,
              backend: currentModelBackend,
            });
            if (msgs.length > 1 && msgs[1]) {
              onAddMessage(requestConversationId, {
                id: uuidv4(),
                role: 'user',
                parts: msgs[1].parts,
                timestamp: Date.now(),
              });
            }
            modelMsgId = uuidv4();
            currentModelText = '';
            currentModelThought = '';
            currentModelApiParts = [];
            rawTextAccumulator = '';
            apiThoughtAccumulator = '';
            isFirstChunk = true;
            if (!hasClientFulfillmentRef) {
               onAddMessage(requestConversationId, {
                 id: modelMsgId,
                 role: 'model',
                 parts: [{ text: '' }],
                 publicText: '',
                 thoughtText: '',
                 thoughtStatus: settings.model.includes('gemma') || settings.model.includes('gemini-3') ? 'thinking' : 'complete',
                 timestamp: Date.now(),
               });
            }
          } else if (chunk.type === 'finish_reason') {
            currentModelFinishReason = chunk.reason;
            updateModelMessage(currentModelText, currentModelThought, 'complete');
          } else if (chunk.type === 'backend') {
            currentModelBackend = chunk.name;
            updateModelMessage(currentModelText, currentModelThought, 'complete');
          }
        }
      }
      
      if (!currentModelText && currentModelThought) {
        updateModelMessage(currentModelThought, '', 'complete');
      } else if (!currentModelText && !currentModelThought) {
         updateModelMessage('[The model returned an empty response. It may have hit a silent safety filter or an API quirk.]', '', 'error');
         setTemporaryPresence('error', 'resting', 5000);
      } else {
        updateModelMessage(currentModelText, currentModelThought, 'complete');
        onUpdateJewel(prev => ({
          ...prev,
          totalMessages: prev.totalMessages + 1,
          totalResponseCharacters: prev.totalResponseCharacters + currentModelText.length,
          lastInteractionTimestamp: Date.now()
        }));
      }
      setTemporaryPresence('complete', 'resting');
    } catch (e: any) {
      console.error("useChatStream error:", e);
      if (e.name === 'AbortError') {
         if (!currentModelText && !currentModelThought) {
            const isGemini3 = settings.model.includes('gemini-3');
            updateModelMessage(`[Request timed out after ${isGemini3 ? 240 : 90} seconds — please try again]`, currentModelThought, 'error');
            setTemporaryPresence('error', 'resting', 5000);
         } else {
            updateModelMessage(currentModelText, currentModelThought, 'complete');
         }
      } else if (e.name === 'RepetitionError') {
         currentModelText += e.message;
         updateModelMessage(currentModelText, currentModelThought, 'complete');
         setTemporaryPresence('repetition_stopped', 'resting', 5000);
      } else if (e.name === 'RateLimitError') {
         currentModelText += `\n\n*${e.message}*`;
         updateModelMessage(currentModelText, currentModelThought, 'complete');
         setTemporaryPresence('rate_limit', 'resting', 3000);
      } else {
         if (!currentModelText && !currentModelThought) {
            updateModelMessage(`[Error: ${e.message}]`, currentModelThought, 'error');
            setTemporaryPresence('error', 'resting', 5000);
         } else {
            currentModelText += `\n\n[Error: ${e.message}]`;
            updateModelMessage(currentModelText, currentModelThought, 'error');
            setTemporaryPresence('error', 'resting', 5000);
         }
      }
    } finally {
      setIsGenerating(false);
      activeGenerationConversationIdRef.current = null;
      if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
      abortControllerRef.current = null;
    }
  }, [
    isGenerating,
    settings,
    gifts,
    profile,
    onUpdate,
    onAddMessage,
    onUpdateMessage,
    onUpdateJewel,
    onAddGift,
    onAddMemory,
    onAddEventLog,
    onAddGemmaNote,
    setTemporaryPresence
  ]);

  const regenerateMessage = useCallback(() => {
    const conv = conversationRef.current;
    if (!conv || conv.messages.length < 2) return;
    const lastUserIndex = conv.messages.map(m => m.role).lastIndexOf('user');
    if (lastUserIndex !== -1) {
      sendMessage(getPublicMessageText(conv.messages[lastUserIndex]) || '', { replaceIndex: lastUserIndex });
    }
  }, [sendMessage]);

  return {
    isGenerating,
    presence,
    setPresence,
    setTemporaryPresence,
    isScanningProfile,
    sendMessage,
    regenerateMessage,
    stopGeneration,
  };
}
