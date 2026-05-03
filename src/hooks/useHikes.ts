import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';
import type { SavedHike } from '@/types/hike';

type UseHikesResult = {
  hikes: SavedHike[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useHikes(): UseHikesResult {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [hikes, setHikes] = useState<SavedHike[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHikes = useCallback(async (): Promise<void> => {
    if (!userId) {
      setHikes([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('hikes')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });
    if (queryError) {
      setError(queryError.message);
      setIsLoading(false);
      return;
    }
    setHikes((data ?? []) as SavedHike[]);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    void fetchHikes();
  }, [fetchHikes]);

  return { hikes, isLoading, error, refresh: fetchHikes };
}
