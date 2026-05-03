import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '@/stores/useAuthStore';

type BiometricKind = 'face' | 'fingerprint' | 'generic';

type UseBiometricLockResult = {
  kind: BiometricKind;
  isAuthenticating: boolean;
  errorMessage: string | null;
  authenticate: () => Promise<void>;
};

export function useBiometricLock(): UseBiometricLockResult {
  const setBiometricUnlocked = useAuthStore(
    (state) => state.setBiometricUnlocked,
  );
  const [kind, setKind] = useState<BiometricKind>('generic');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoTriggered = useRef(false);

  const authenticate = useCallback(async (): Promise<void> => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // No biometric available — don't lock the user out of their data.
        console.warn(
          'Biometric hardware/enrollment unavailable; bypassing app lock.',
        );
        setBiometricUnlocked(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock HikeMate',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setBiometricUnlocked(true);
        setErrorMessage(null);
      } else if (result.error !== 'user_cancel') {
        setErrorMessage('Authentication failed. Try again.');
      } else {
        setErrorMessage(null);
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, [setBiometricUnlocked]);

  useEffect(() => {
    let cancelled = false;
    LocalAuthentication.supportedAuthenticationTypesAsync()
      .then((types) => {
        if (cancelled) return;
        if (
          types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          )
        ) {
          setKind('face');
        } else if (
          types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ) {
          setKind('fingerprint');
        } else {
          setKind('generic');
        }
      })
      .catch(() => {
        if (!cancelled) setKind('generic');
      });
    return (): void => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (autoTriggered.current) return;

    // Wait for the app to be fully active before prompting. Firing
    // authenticateAsync while AppState is 'inactive' or 'background' (e.g.
    // during cold-launch transitions) causes the iOS prompt to flash and
    // immediately fail with a generic "Authentication failed" error.
    if (AppState.currentState === 'active') {
      autoTriggered.current = true;
      void authenticate();
      return;
    }

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !autoTriggered.current) {
        autoTriggered.current = true;
        sub.remove();
        void authenticate();
      }
    });
    return (): void => sub.remove();
  }, [authenticate]);

  return { kind, isAuthenticating, errorMessage, authenticate };
}
