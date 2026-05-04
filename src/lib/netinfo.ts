import NetInfo from '@react-native-community/netinfo';

/**
 * Treat the device as online when:
 *   - It reports a connection AND
 *   - reachability isn't explicitly false (null is acceptable: NetInfo
 *     returns null while it's still confirming reachability, and we'd
 *     rather optimistically be online than flap to offline during the
 *     determination window).
 */
export async function fetchOnlineState(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

export function subscribeToOnlineState(
  callback: (online: boolean) => void,
): () => void {
  return NetInfo.addEventListener((state) => {
    callback(state.isConnected === true && state.isInternetReachable !== false);
  });
}
