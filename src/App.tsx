/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from './lib/store';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Settings } from './components/Settings';
import { LevinJewel } from './components/LevinJewel';
import { GiftsArchive } from './components/GiftsArchive';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { getMotion } from './lib/motion';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './lib/firebase';

function MainApp({ user }: { user: any }) {
  const store = useAppStore(user);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jewelOpen, setJewelOpen] = useState(false);
  const [giftsOpen, setGiftsOpen] = useState(false);

  const currentConversation = store.conversations.find(c => c.id === store.currentId);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-obsidian text-pearlescent relative w-full">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-50 lg:relative transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 w-80 shrink-0`}>
        <Sidebar 
          conversations={store.conversations}
          currentId={store.currentId}
          onSelect={(id) => {
            store.setCurrentId(id);
            if (window.innerWidth < 1024) setSidebarOpen(false);
          }}
          onNew={() => {
            store.createConversation();
            store.updateJewelMetrics(prev => ({ ...prev, totalSessions: prev.totalSessions + 1 }));
            if (window.innerWidth < 1024) setSidebarOpen(false);
          }}
          onDelete={store.deleteConversation}
          onRename={store.renameConversation}
          isOpen={true}
        />
      </div>
      
      <ChatArea 
        key={currentConversation?.id ?? 'no-conversation'}
        conversation={currentConversation}
        settings={store.settings}
        gifts={store.gifts}
        jewelMetrics={store.jewelMetrics}
        onUpdate={store.updateConversation}
        onAddMessage={store.addMessage}
        onUpdateMessage={store.updateMessage}
        onRemoveMessage={store.removeMessage}
        onUpdateJewel={store.updateJewelMetrics}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenJewel={() => setJewelOpen(true)}
        onOpenGifts={() => setGiftsOpen(true)}
        availableModels={store.availableModels}
        onAddGift={store.addGift}
        onAddMemory={store.addMemory}
        onAddEventLog={store.addEventLog}
      />

      <AnimatePresence>
        {giftsOpen && (
          <GiftsArchive gifts={store.gifts} onClose={() => setGiftsOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && (
          <Settings 
            settings={store.settings}
            onSave={store.updateSettings}
            onClose={() => setSettingsOpen(false)}
            availableModels={store.availableModels}
            isModelsLoading={store.isModelsLoading}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {jewelOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={modalMotion}
              className="bg-ink border border-glass-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col relative"
            >
              <button onClick={() => setJewelOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-glass rounded-full transition-colors z-10 text-mauve hover:text-champagne">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <LevinJewel metrics={store.jewelMetrics} onReset={store.resetJewel} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-obsidian text-pearlescent">
        <p className="text-mauve tracking-widest uppercase text-sm animate-pulse">Waking the sanctuary...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-obsidian text-pearlescent relative w-full p-4">
        <div className="bg-ink border border-glass-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col p-8 items-center text-center">
          <h1 className="text-2xl font-bold mb-2">Midnight Sanctuary</h1>
          <p className="text-mauve mb-8">Please sign in to access your sanctuary.</p>
          <button 
            onClick={handleSignIn}
            className="px-6 py-3 bg-glass border border-glass-border rounded-xl hover:bg-white/10 transition-colors flex items-center gap-3 font-medium"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (user.email !== 'ahatley094@gmail.com') {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-obsidian text-pearlescent relative w-full p-4">
        <div className="bg-ink border border-glass-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col p-8 items-center text-center">
          <h1 className="text-xl text-red-400 font-bold mb-2">Access Denied</h1>
          <p className="text-mauve mb-8">This sanctuary is private. You are signed in as {user.email}.</p>
          <button 
            onClick={handleSignOut}
            className="px-6 py-3 bg-glass border border-glass-border rounded-xl hover:bg-white/10 transition-colors font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <MainApp user={user} />;
}
