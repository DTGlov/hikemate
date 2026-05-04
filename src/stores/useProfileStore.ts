import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import type { UnitSystem } from '@/lib/units';

export type SubscriptionTier = 'free' | 'pro';

export interface UserProfile {
  id: string;
  display_name: string | null;
  unit_system: UnitSystem;
  subscription_tier: SubscriptionTier;
  avatar_seed: string;
  created_at: string;
  updated_at: string;
}

type ProfileState = {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  loadProfile: (userId: string) => Promise<void>;
  updateUnitSystem: (next: UnitSystem) => Promise<void>;
  updateDisplayName: (next: string) => Promise<{ error: string | null }>;
  updateAvatarSeed: (next: string) => Promise<{ error: string | null }>;
  reset: () => void;
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  loadProfile: async (userId: string): Promise<void> => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      set({ isLoading: false, error: error.message });
      return;
    }
    set({ profile: data as UserProfile, isLoading: false });
  },

  updateUnitSystem: async (next: UnitSystem): Promise<void> => {
    const current = get().profile;
    if (!current) return;
    // Optimistic update — flip immediately so the UI is responsive.
    set({ profile: { ...current, unit_system: next } });
    const { error } = await supabase
      .from('profiles')
      .update({ unit_system: next })
      .eq('id', current.id);
    if (error) {
      // Revert on failure.
      set({ profile: current, error: error.message });
    }
  },

  updateDisplayName: async (
    next: string,
  ): Promise<{ error: string | null }> => {
    const current = get().profile;
    if (!current) return { error: 'No profile loaded' };
    const trimmed = next.trim();
    set({ profile: { ...current, display_name: trimmed } });
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', current.id);
    if (error) {
      set({ profile: current });
      return { error: error.message };
    }
    // Mirror the new name into any active crew membership rows so peers
    // see the change via the realtime UPDATE on room_members. RLS limits
    // this to the current user's own rows. Failure here is non-fatal —
    // profiles is the source of truth; crew snapshots just shadow it.
    const { error: roomError } = await supabase
      .from('room_members')
      .update({ display_name: trimmed })
      .eq('user_id', current.id);
    if (roomError) {
      console.warn(
        '[profile] room_members display_name sync failed:',
        roomError.message,
      );
    }
    return { error: null };
  },

  updateAvatarSeed: async (
    next: string,
  ): Promise<{ error: string | null }> => {
    const current = get().profile;
    if (!current) return { error: 'No profile loaded' };
    set({ profile: { ...current, avatar_seed: next } });
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_seed: next })
      .eq('id', current.id);
    if (error) {
      set({ profile: current });
      return { error: error.message };
    }
    // Same crew-shadow pattern as updateDisplayName so live crew rows
    // reflect the new avatar without rejoin.
    const { error: roomError } = await supabase
      .from('room_members')
      .update({ avatar_seed: next })
      .eq('user_id', current.id);
    if (roomError) {
      console.warn(
        '[profile] room_members avatar_seed sync failed:',
        roomError.message,
      );
    }
    return { error: null };
  },

  reset: (): void => {
    set({ profile: null, isLoading: false, error: null });
  },
}));
