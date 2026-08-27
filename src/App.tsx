import React, { useState } from 'react';
import { useAppStore } from './lib/store';
import { AppProvider, UIState } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Settings } from './components/Settings';
import { LevinJewel } from './components/LevinJewel';
import { GiftsArchive } from './components/GiftsArchive';
import { MemoriesArchive } from './components/MemoriesArchive';
import { ProfileModal } from './components/ProfileModal';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { getMotion } from './lib/motion';

export function App() {
  const store = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jewelOpen, setJewelOpen] = useState(false);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [memoriesOpen, setMemoriesOpen] = useState(false);

  const reducedMotion = useReducedMotion();
  const modalMotion = getMotion('heavy', reducedMotion);

  const ui: UIState = {
    sidebarOpen,
    setSidebarOpen,
    settingsOpen,
    setSettingsOpen,
    jewelOpen,
    setJewelOpen,
    giftsOpen,
    setGiftsOpen,
    profileOpen,
    setProfileOpen,
    memoriesOpen,
    setMemoriesOpen,
  };

  return (
    <AppProvider store={store} ui={ui}>
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

        {/* Modals & Dialogs */}
        <AnimatePresence>
          {settingsOpen && <Settings key="settings-modal" />}

          {giftsOpen && <GiftsArchive key="gifts-modal" />}

          {memoriesOpen && <MemoriesArchive key="memories-modal" />}

          {profileOpen && <ProfileModal key="profile-modal" />}

          {jewelOpen && (
            <motion.div
              key="jewel-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151234]/90 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={modalMotion}
                className="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-xl flex flex-col relative overflow-hidden"
              >
                <div className="flex items-center justify-between p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
                  <div>
                    <h2 className="text-2xl font-bold text-[#F5E1C8] tracking-tight">The Levin Jewel</h2>
                    <p className="text-sm font-bold text-[#B39DE5]">Sanctuary Resonance & Insights</p>
                  </div>
                  <button
                    onClick={() => setJewelOpen(false)}
                    className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
                <LevinJewel />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppProvider>
  );
}
export default App;
