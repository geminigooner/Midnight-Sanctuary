import fs from 'fs';
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const searchImports = `import { Conversation, AppSettings, DEFAULT_SETTINGS, JewelMetrics, DEFAULT_JEWEL_METRICS, ModelInfo, Gift, Message } from './types';`;
const replaceImports = `import { Conversation, AppSettings, DEFAULT_SETTINGS, JewelMetrics, DEFAULT_JEWEL_METRICS, ModelInfo, Gift, Message, UserProfile } from './types';`;
code = code.replace(searchImports, replaceImports);

const searchState = `  const [gifts, setGifts] = useState<Gift[]>([]);`;
const replaceState = `  const [gifts, setGifts] = useState<Gift[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);`;
code = code.replace(searchState, replaceState);

const searchLoad = `          if (data.gifts) setGifts(data.gifts);`;
const replaceLoad = `          if (data.gifts) setGifts(data.gifts);
          if (data.userProfile) setProfile(data.userProfile);`;
code = code.replace(searchLoad, replaceLoad);

const searchSave = `        setDoc(userDocRef, {
          conversations,
          settings,
          jewelMetrics,
          gifts
        }, { merge: true });`;
const replaceSave = `        const payload: any = {
          conversations,
          settings,
          jewelMetrics,
          gifts
        };
        if (profile) payload.userProfile = profile;
        setDoc(userDocRef, payload, { merge: true });`;
code = code.replace(searchSave, replaceSave);

const searchDeps = `  }, [conversations, settings, jewelMetrics, gifts, dataLoaded, user]);`;
const replaceDeps = `  }, [conversations, settings, jewelMetrics, gifts, profile, dataLoaded, user]);`;
code = code.replace(searchDeps, replaceDeps);

const searchExports = `    addGift,
    addMemory,
    addEventLog,
  };
}`;
const replaceExports = `    addGift,
    addMemory,
    addEventLog,
    profile,
    updateProfile: (newProfile: UserProfile) => setProfile(newProfile),
    addGemmaNote: (note: string) => setProfile(prev => prev ? { ...prev, gemmaNotes: [{ text: note, timestamp: Date.now() }, ...(prev.gemmaNotes || [])] } : { name: 'User', gemmaNotes: [{ text: note, timestamp: Date.now() }] }),
  };
}`;
code = code.replace(searchExports, replaceExports);

fs.writeFileSync('src/lib/store.ts', code);
