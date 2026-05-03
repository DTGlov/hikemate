import type { AuthError, Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

type AuthResult = { error: AuthError | null };

type AuthState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isBiometricUnlocked: boolean;
  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  setBiometricUnlocked: (value: boolean) => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  isBiometricUnlocked: false,

  initialize: async (): Promise<void> => {
    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      isLoading: false,
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      const previousSession = get().session;
      set({
        session,
        user: session?.user ?? null,
      });
      // Reset biometric unlock when the user signs out so a future login
      // re-prompts. Don't reset on token refresh (same user, new tokens).
      if (previousSession && !session) {
        set({ isBiometricUnlocked: false });
      }
    });
  },

  signUp: async (email, password): Promise<AuthResult> => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  },

  signIn: async (email, password): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  },

  signOut: async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      set({
        session: null,
        user: null,
        isBiometricUnlocked: false,
      });
    }
    return { error };
  },

  setBiometricUnlocked: (value: boolean): void => {
    set({ isBiometricUnlocked: value });
  },
}));
