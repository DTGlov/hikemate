import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and set ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

// SecureStore caps a single value at ~2KB. Supabase sessions can be larger,
// so we transparently chunk values across multiple keys.
const CHUNK_SIZE = 1800;

const secureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const head = await SecureStore.getItemAsync(key);
    if (head === null) return null;
    if (!head.startsWith('__chunked__:')) return head;
    const count = Number(head.slice('__chunked__:'.length));
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(key, `__chunked__:${count}`);
    for (let i = 0; i < count; i++) {
      const slice = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}.${i}`, slice);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    const head = await SecureStore.getItemAsync(key);
    await SecureStore.deleteItemAsync(key);
    if (head !== null && head.startsWith('__chunked__:')) {
      const count = Number(head.slice('__chunked__:'.length));
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}.${i}`);
      }
    }
  },
};

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: secureStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
