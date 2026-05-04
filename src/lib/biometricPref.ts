import * as SecureStore from 'expo-secure-store';

const KEY = 'hikemate_biometric_lock_enabled';

export async function getBiometricLockPref(): Promise<boolean | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (raw === null) return null;
  return raw === '1';
}

export async function setBiometricLockPref(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY, enabled ? '1' : '0');
}

/**
 * One-shot migration for users who predate the pref. Existing users (who
 * already have a session restored on this device) keep biometric ON to
 * preserve their security posture; new users default to OFF. Idempotent
 * after first run because the pref is then set.
 */
export async function ensureBiometricLockPref(
  hasExistingSession: boolean,
): Promise<boolean> {
  const current = await getBiometricLockPref();
  if (current !== null) return current;
  const next = hasExistingSession;
  await setBiometricLockPref(next);
  return next;
}
