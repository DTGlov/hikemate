import type { AuthError, Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

type AuthResult = { error: AuthError | null };

type AuthState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isBiometricUnlocked: boolean;
  // Timestamp (ms) of the most recent successful biometric unlock. Used by
  // BiometricGate's grace period to skip the prompt for a brief window after
  // a successful unlock — so transient backgrounding doesn't force re-auth.
  lastUnlockedAt: number | null;
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
  lastUnlockedAt: null,

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
        set({ isBiometricUnlocked: false, lastUnlockedAt: null });
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
        lastUnlockedAt: null,
      });
    }
    return { error };
  },

  setBiometricUnlocked: (value: boolean): void => {
    // Stamp the unlock time on success so the gate's grace period can skip
    // re-prompting for a brief window. Don't clear the timestamp on lock —
    // the grace window is exactly the gap between lock and re-evaluation.
    if (value) {
      set({ isBiometricUnlocked: true, lastUnlockedAt: Date.now() });
    } else {
      set({ isBiometricUnlocked: false });
    }
  },
}));
