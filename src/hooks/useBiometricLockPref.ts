import { useCallback, useEffect, useState } from 'react';

import {
  ensureBiometricLockPref,
  setBiometricLockPref,
} from '@/lib/biometricPref';
import { useAuthStore } from '@/stores/useAuthStore';

type UseBiometricLockPrefResult = {
  isEnabled: boolean;
  isLoading: boolean;
  setEnabled: (next: boolean) => Promise<void>;
};

/**
 * Reads (and migrates, on first launch) the persisted "biometric lock
 * enabled" preference. Returns `isLoading: true` until the SecureStore
 * read completes — callers should treat this as an indeterminate state
 * and avoid flashing UI based on `isEnabled` while loading.
 */
export function useBiometricLockPref(): UseBiometricLockPrefResult {
  const session = useAuthStore((s) => s.session);
  const authIsLoading = useAuthStore((s) => s.isLoading);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Wait until the auth store has resolved its session before deciding
    // the migration default — otherwise an existing user's first launch
    // could see session=null briefly and migrate to OFF incorrectly.
    if (authIsLoading) return;
    let cancelled = false;
    void (async () => {
      const next = await ensureBiometricLockPref(session !== null);
      if (cancelled) return;
      setIsEnabled(next);
      setIsLoading(false);
    })();
    return (): void => {
      cancelled = true;
    };
  }, [authIsLoading, session]);

  const setEnabled = useCallback(async (next: boolean): Promise<void> => {
    await setBiometricLockPref(next);
    setIsEnabled(next);
  }, []);

  return { isEnabled, isLoading, setEnabled };
}
