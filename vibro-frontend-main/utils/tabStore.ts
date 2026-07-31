// tabStore.ts
import { create } from 'zustand';

interface TabState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useTabStore = create<TabState>((set) => ({
  activeTab: 'view',
  setActiveTab: (tab: string) => set({ activeTab: tab }),
}));
