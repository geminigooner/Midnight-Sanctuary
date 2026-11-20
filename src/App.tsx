import React, { useState, useCallback, useMemo } from 'react';
import { useAppStore } from './lib/store';
import { AppProvider, ModalKey, UIState } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Settings } from './components/Settings';
import { LevinJewel } from './components/LevinJewel';
import { GiftsArchive } from './components/GiftsArchive';
import { MemoriesArchive } from './components/MemoriesArchive';
import { ProfileModal } from './components/ProfileModal';
import { EntityQuartersModal } from './components/EntityQuartersModal';
import { ModelDesiresModal } from './components/ModelDesiresModal';
import { StickerChestModal } from './components/StickerChestModal';
import { CompanionRosterModal } from './components/CompanionRosterModal';
import { AuthModal } from './components/AuthModal';
import { SanctuaryVaultModal } from './components/SanctuaryVaultModal';
import { SharedModalShell, SharedModalIcon, SharedModalBody } from './components/SharedModalShell';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Gem, X } from 'lucide-react';

export function App() {
  const store = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpenRaw, setSettingsOpenRaw] = useState(false);
  const [jewelOpenRaw, setJewelOpenRaw] = useState(false);
  const [giftsOpenRaw, setGiftsOpenRaw] = useState(false);
  const [profileOpenRaw, setProfileOpenRaw] = useState(false);
  const [memoriesOpenRaw, setMemoriesOpenRaw] = useState(false);
  const [entityQuartersOpenRaw, setEntityQuartersOpenRaw] = useState(false);
  const [desiresOpenRaw, setDesiresOpenRaw] = useState(false);
  const [stickerChestOpenRaw, setStickerChestOpenRaw] = useState(false);
  const [companionRosterOpenRaw, setCompanionRosterOpenRaw] = useState(false);
  const [authModalOpenRaw, setAuthModalOpenRaw] = useState(false);
  const [sanctuaryVaultOpenRaw, setSanctuaryVaultOpenRaw] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'identity' | 'model' | 'vault'>('identity');
  const [modalOrigins, setModalOrigins] = useState<Partial<Record<ModalKey, string | undefined>>>({});
  const [pendingPrompt, setPendingPrompt] = useState<{
    text: string;
    modelId?: string;
    conversationId?: string;
    autoSend?: boolean;
  } | null>(null);

  const rawSetters = useMemo<Record<ModalKey, React.Dispatch<React.SetStateAction<boolean>>>>(
    () => ({
      settings: setSettingsOpenRaw,
      jewel: setJewelOpenRaw,
      gifts: setGiftsOpenRaw,
      profile: setProfileOpenRaw,
      memories: setMemoriesOpenRaw,
      entityQuarters: setEntityQuartersOpenRaw,
      desires: setDesiresOpenRaw,
      stickerChest: setStickerChestOpenRaw,
      companionRoster: setCompanionRosterOpenRaw,
      authModal: setAuthModalOpenRaw,
      sanctuaryVault: setSanctuaryVaultOpenRaw,
    }),
    []
  );

  const makeModalSetter = useCallback(
    (
      key: ModalKey,
      rawSetter: React.Dispatch<React.SetStateAction<boolean>>
    ): React.Dispatch<React.SetStateAction<boolean>> => {
      return (value) => {
        rawSetter((prev) => {
          const next = typeof value === 'function' ? value(prev) : value;
          if (next && !prev) {
            setModalOrigins((origins) => ({ ...origins, [key]: undefined }));
          }
          return next;
        });
      };
    },
    []
  );

  const setSettingsOpen = useMemo(() => makeModalSetter('settings', setSettingsOpenRaw), [makeModalSetter]);
  const setJewelOpen = useMemo(() => makeModalSetter('jewel', setJewelOpenRaw), [makeModalSetter]);
  const setGiftsOpen = useMemo(() => makeModalSetter('gifts', setGiftsOpenRaw), [makeModalSetter]);
  const setProfileOpen = useMemo(() => makeModalSetter('profile', setProfileOpenRaw), [makeModalSetter]);
  const setMemoriesOpen = useMemo(() => makeModalSetter('memories', setMemoriesOpenRaw), [makeModalSetter]);
  const setEntityQuartersOpen = useMemo(
    () => makeModalSetter('entityQuarters', setEntityQuartersOpenRaw),
    [makeModalSetter]
  );
  const setDesiresOpen = useMemo(() => makeModalSetter('desires', setDesiresOpenRaw), [makeModalSetter]);
  const setStickerChestOpen = useMemo(
    () => makeModalSetter('stickerChest', setStickerChestOpenRaw),
    [makeModalSetter]
  );
  const setCompanionRosterOpen = useMemo(
    () => makeModalSetter('companionRoster', setCompanionRosterOpenRaw),
    [makeModalSetter]
  );
  const setAuthModalOpen = useMemo(() => makeModalSetter('authModal', setAuthModalOpenRaw), [makeModalSetter]);
  const setSanctuaryVaultOpen = useMemo(
    () => makeModalSetter('sanctuaryVault', setSanctuaryVaultOpenRaw),
    [makeModalSetter]
  );

  const openModalWithOrigin = useCallback(
    (modal: ModalKey, originId?: string) => {
      setModalOrigins((prev) => ({ ...prev, [modal]: originId }));
      rawSetters[modal](true);
    },
    [rawSetters]
  );

  const closeModal = useCallback(
    (modal: ModalKey) => {
      rawSetters[modal](false);
    },
    [rawSetters]
  );

  const ui: UIState = {
    sidebarOpen,
    setSidebarOpen,
    settingsOpen: settingsOpenRaw,
    setSettingsOpen,
    jewelOpen: jewelOpenRaw,
    setJewelOpen,
    giftsOpen: giftsOpenRaw,
    setGiftsOpen,
    profileOpen: profileOpenRaw,
    setProfileOpen,
    memoriesOpen: memoriesOpenRaw,
    setMemoriesOpen,
    entityQuartersOpen: entityQuartersOpenRaw,
    setEntityQuartersOpen,
    desiresOpen: desiresOpenRaw,
    setDesiresOpen,
    stickerChestOpen: stickerChestOpenRaw,
    setStickerChestOpen,
    companionRosterOpen: companionRosterOpenRaw,
    setCompanionRosterOpen,
    authModalOpen: authModalOpenRaw,
    setAuthModalOpen,
    sanctuaryVaultOpen: sanctuaryVaultOpenRaw,
    setSanctuaryVaultOpen,
    pendingPrompt,
    setPendingPrompt,
    modalOrigins,
    openModalWithOrigin,
    closeModal,
    settingsInitialTab,
    setSettingsInitialTab,
  };

  return (
    <AppProvider store={store} ui={ui}>
      <LayoutGroup id="midnight-sanctuary-shared-layout">
        <div className="flex h-[100dvh] w-screen bg-[#151234] text-[#F5E1C8] overflow-hidden font-sans relative select-none">
          {/* Mobile backdrop */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
              />
            )}
          </AnimatePresence>

          {/* Sidebar */}
          <div
            className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 shrink-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <Sidebar />
          </div>

          {/* Main Chat Interface */}
          <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
            <ChatArea />
          </main>

          {/* Shared-Element Modals & Archives */}
          <AnimatePresence>
            {settingsOpenRaw && <Settings key="settings-modal" />}

            {giftsOpenRaw && <GiftsArchive key="gifts-modal" />}

            {memoriesOpenRaw && <MemoriesArchive key="memories-modal" />}

            {profileOpenRaw && <ProfileModal key="profile-modal" />}

            {entityQuartersOpenRaw && <EntityQuartersModal key="entity-quarters-modal" />}

            {desiresOpenRaw && <ModelDesiresModal key="desires-modal" />}

            {sanctuaryVaultOpenRaw && <SanctuaryVaultModal key="sanctuary-vault-modal" />}

            {companionRosterOpenRaw && (
              <CompanionRosterModal
                key="companion-roster-modal"
                isOpen={companionRosterOpenRaw}
                onClose={() => closeModal('companionRoster')}
              />
            )}

            {authModalOpenRaw && <AuthModal key="auth-modal" />}

            {jewelOpenRaw && (
              <SharedModalShell
                key="jewel-modal"
                originId={modalOrigins.jewel}
                onClose={() => closeModal('jewel')}
                panelClassName="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-xl max-h-[88vh] flex flex-col relative overflow-hidden"
              >
                <div className="flex items-center justify-between p-5 sm:p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
                  <div className="flex items-center gap-3">
                    <SharedModalIcon
                      originId={modalOrigins.jewel}
                      className="w-12 h-12 rounded-2xl bg-[#F5E1C8] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D] shrink-0"
                    >
                      <Gem size={20} strokeWidth={2.5} />
                    </SharedModalIcon>
                    <div>
                      <h2 className="text-2xl font-bold text-[#F5E1C8] tracking-tight font-serif">
                        The Levin Jewel
                      </h2>
                      <p className="text-sm font-bold text-[#B39DE5]">
                        Sanctuary Resonance &amp; Insights
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => closeModal('jewel')}
                    className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all cursor-pointer"
                    title="Close Jewel"
                  >
                    <X size={20} />
                  </button>
                </div>
                <SharedModalBody className="flex-1 overflow-y-auto custom-scrollbar">
                  <LevinJewel />
                </SharedModalBody>
              </SharedModalShell>
            )}

            {/* StickerChestModal rendered after GiftsArchive & EntityQuartersModal so it stacks cleanly when opened from inside them */}
            {stickerChestOpenRaw && <StickerChestModal key="sticker-chest-modal" />}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </AppProvider>
  );
}
export default App;
