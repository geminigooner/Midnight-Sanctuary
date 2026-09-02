import React, { createContext, useContext, ReactNode } from 'react';
import { useAppStore } from '../lib/store';

export type AppStore = ReturnType<typeof useAppStore>;

export interface PendingPromptData {
  text: string;
  modelId?: string;
  conversationId?: string;
  autoSend?: boolean;
}

export interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  jewelOpen: boolean;
  setJewelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  giftsOpen: boolean;
  setGiftsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  profileOpen: boolean;
  setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  memoriesOpen: boolean;
  setMemoriesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  entityQuartersOpen: boolean;
  setEntityQuartersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  desiresOpen: boolean;
  setDesiresOpen: React.Dispatch<React.SetStateAction<boolean>>;
  stickerChestOpen: boolean;
  setStickerChestOpen: React.Dispatch<React.SetStateAction<boolean>>;
  companionRosterOpen: boolean;
  setCompanionRosterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pendingPrompt: PendingPromptData | null;
  setPendingPrompt: React.Dispatch<React.SetStateAction<PendingPromptData | null>>;
}

export interface AppContextType {
  store: AppStore;
  ui: UIState;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({
  children,
  store,
  ui,
}: {
  children: ReactNode;
  store: AppStore;
  ui: UIState;
}) {
  return (
    <AppContext.Provider value={{ store, ui }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export function useStore(): AppStore {
  return useApp().store;
}

export function useUI(): UIState {
  return useApp().ui;
}
