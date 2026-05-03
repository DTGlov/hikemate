import { create } from 'zustand';

type AppState = {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  setIsAuthenticated: (value: boolean): void => set({ isAuthenticated: value }),
}));
