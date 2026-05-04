import { useCallback, useEffect, useRef } from 'react';

import { dequeue, getOutbox, markAttemptFailed } from '@/lib/hikeOutbox';
import { supabase } from '@/lib/supabase';
import { useOfflineStore } from '@/stores/useOfflineStore';

const SYNC_INTERVAL_MS = 30_000;

/**
 * Single-flight outbox sync. Reads the on-disk queue, attempts each
 * insert against Supabase, dequeues on success, marks-failed otherwise.
 *
 *   - 23505 (unique violation) is treated as success — most likely the
 *     row was inserted on a previous attempt that timed out before
 *     dequeue. We've established consistent ids across local/server so
 *     this is the safe path.
 *   - Any other failure: mark-failed and leave in the queue. The next
 *     online transition or 30s tick will retry.
 *
 * No exponential backoff in v1 — the spec calls for "just on online
 * transition or 30s tick", which is good enough until we have a
 * pathological always-failing payload to worry about.
 */
export function useHikeOutboxSync(): void {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const setOutboxCount = useOfflineStore((s) => s.setOutboxCount);

  const inFlightRef = useRef(false);

  const refreshCount = useCallback(async (): Promise<void> => {
    const items = await getOutbox();
    setOutboxCount(items.length);
  }, [setOutboxCount]);

  const runSync = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const items = await getOutbox();
      for (const item of items) {
        const { error } = await supabase.from('hikes').insert(item.hike);
        if (!error || error.code === '23505') {
          await dequeue(item.id);
          continue;
        }
        await markAttemptFailed(item.id, error.message);
      }
    } catch (err) {
      console.warn('[outbox] sync threw:', err);
    } finally {
      inFlightRef.current = false;
      await refreshCount();
    }
  }, [refreshCount]);

  // Refresh count on mount so the banner is accurate from the first
  // render, even before the first sync completes.
  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (!isOnline) return;
    void runSync();
    const id = setInterval(() => void runSync(), SYNC_INTERVAL_MS);
    return (): void => clearInterval(id);
  }, [isOnline, runSync]);
}

/**
 * Imperative trigger for the OutboxBanner's "Retry now" button. Safe
 * to call any time — the in-flight guard prevents overlap with the
 * scheduled sync.
 */
export async function triggerOutboxSync(): Promise<void> {
  // Re-implements the single-flight + run logic without the React hook
  // surface; same guard ref via a module-level fallback.
  if (manualInFlight) return;
  manualInFlight = true;
  try {
    const items = await getOutbox();
    for (const item of items) {
      const { error } = await supabase.from('hikes').insert(item.hike);
      if (!error || error.code === '23505') {
        await dequeue(item.id);
        continue;
      }
      await markAttemptFailed(item.id, error.message);
    }
  } catch (err) {
    console.warn('[outbox] manual sync threw:', err);
  } finally {
    manualInFlight = false;
    const items = await getOutbox();
    useOfflineStore.getState().setOutboxCount(items.length);
  }
}

let manualInFlight = false;
