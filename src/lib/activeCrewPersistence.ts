import * as SecureStore from 'expo-secure-store';

// SecureStore key strings keep their original "Room" form so devices
// updated from earlier builds don't lose silent-rejoin / pending-deep-link
// data. Don't rename these — the JS function names (getActiveCrewId etc.)
// are the engineer-facing surface.
const ACTIVE_CREW_KEY = 'hikemate.activeRoomId';
const PENDING_DEEP_LINK_CODE_KEY = 'hikemate.pendingRoomCode';

export async function getActiveCrewId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_CREW_KEY);
}

export async function setActiveCrewId(crewId: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_CREW_KEY, crewId);
}

export async function clearActiveCrewId(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_CREW_KEY);
}

export async function getPendingCrewCode(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_DEEP_LINK_CODE_KEY);
}

export async function setPendingCrewCode(code: string): Promise<void> {
  await SecureStore.setItemAsync(PENDING_DEEP_LINK_CODE_KEY, code);
}

export async function clearPendingCrewCode(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_DEEP_LINK_CODE_KEY);
}
