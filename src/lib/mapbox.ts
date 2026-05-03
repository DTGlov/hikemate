import Mapbox from '@rnmapbox/maps';

let initialized = false;

export function initMapbox(): void {
  if (initialized) return;
  initialized = true;

  const token = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN;
  if (!token) {
    console.warn(
      'EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN is missing. Map tiles will not load. ' +
        'Add a public Mapbox token (pk.…) to .env.',
    );
    return;
  }
  void Mapbox.setAccessToken(token);
}
