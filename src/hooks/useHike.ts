import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { SavedHike } from '@/types/hike';

type UseHikeResult = {
  hike: SavedHike | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useHike(id: string | null): UseHikeResult {
  const [hike, setHike] = useState<SavedHike | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHike = useCallback(async (): Promise<void> => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('hikes')
      .select('*')
      .eq('id', id)
      .single();
    if (queryError) {
      setError(queryError.message);
      setIsLoading(false);
      return;
    }
    setHike(data as SavedHike);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    void fetchHike();
  }, [fetchHike]);

  return { hike, isLoading, error, refresh: fetchHike };
}
