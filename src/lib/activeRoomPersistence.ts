import * as SecureStore from 'expo-secure-store';

const ACTIVE_ROOM_KEY = 'hikemate.activeRoomId';
const PENDING_DEEP_LINK_CODE_KEY = 'hikemate.pendingRoomCode';

export async function getActiveRoomId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_ROOM_KEY);
}

export async function setActiveRoomId(roomId: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_ROOM_KEY, roomId);
}

export async function clearActiveRoomId(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_ROOM_KEY);
}

export async function getPendingRoomCode(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_DEEP_LINK_CODE_KEY);
}

export async function setPendingRoomCode(code: string): Promise<void> {
  await SecureStore.setItemAsync(PENDING_DEEP_LINK_CODE_KEY, code);
}

export async function clearPendingRoomCode(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_DEEP_LINK_CODE_KEY);
}
