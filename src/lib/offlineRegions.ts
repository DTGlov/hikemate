import Mapbox from '@rnmapbox/maps';

import type { OfflineRegionMeta } from '@/stores/useOfflineStore';

export const OFFLINE_MIN_ZOOM = 10;
export const OFFLINE_MAX_ZOOM = 16;
export const OFFLINE_TILE_COUNT_LIMIT = 12_000; // ~3 city-scale regions

export type DownloadProgress = {
  percentage: number;
  completedTileCount: number;
  completedResourceSize: number;
};

type StoredMetadata = {
  boundsNE: [number, number];
  boundsSW: [number, number];
  minZoom: number;
  maxZoom: number;
  styleURL: string;
  downloadedAt: string;
};

let tileCountLimitApplied = false;
function applyTileCountLimitOnce(): void {
  if (tileCountLimitApplied) return;
  tileCountLimitApplied = true;
  try {
    Mapbox.offlineManager.setTileCountLimit(OFFLINE_TILE_COUNT_LIMIT);
  } catch (err) {
    console.warn('[offlineRegions] setTileCountLimit failed:', err);
  }
}

function decodeMetadata(raw: unknown): StoredMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (
    !Array.isArray(m.boundsNE) ||
    !Array.isArray(m.boundsSW) ||
    typeof m.styleURL !== 'string' ||
    typeof m.downloadedAt !== 'string'
  ) {
    return null;
  }
  return {
    boundsNE: m.boundsNE as [number, number],
    boundsSW: m.boundsSW as [number, number],
    minZoom: typeof m.minZoom === 'number' ? m.minZoom : OFFLINE_MIN_ZOOM,
    maxZoom: typeof m.maxZoom === 'number' ? m.maxZoom : OFFLINE_MAX_ZOOM,
    styleURL: m.styleURL,
    downloadedAt: m.downloadedAt,
  };
}

/** List all packs known to the Mapbox SDK as our typed metadata. */
export async function loadRegions(): Promise<OfflineRegionMeta[]> {
  applyTileCountLimitOnce();
  const packs = await Mapbox.offlineManager.getPacks();
  return packs
    .map<OfflineRegionMeta | null>((pack) => {
      const name = pack.name as string;
      const meta = decodeMetadata(pack.metadata);
      if (!meta) return null;
      return {
        name,
        boundsNE: meta.boundsNE,
        boundsSW: meta.boundsSW,
        minZoom: meta.minZoom,
        maxZoom: meta.maxZoom,
        styleURL: meta.styleURL,
        downloadedAt: meta.downloadedAt,
        sizeBytes: 0,
      };
    })
    .filter((r): r is OfflineRegionMeta => r !== null);
}

/**
 * Kick off a Mapbox offline pack download. Bounds are passed in our
 * neutral [neLng, neLat] / [swLng, swLat] form; we translate to Mapbox's
 * `[NE, SW]` array argument.
 *
 * The promise resolves when the pack is created (queued); progress comes
 * via the listener callback, which receives a 0–100 percentage and the
 * final completed-resource-size at percentage === 100.
 */
export async function downloadRegion(params: {
  name: string;
  boundsNE: [number, number];
  boundsSW: [number, number];
  styleURL: string;
  onProgress?: (progress: DownloadProgress) => void;
}): Promise<OfflineRegionMeta> {
  applyTileCountLimitOnce();
  const { name, boundsNE, boundsSW, styleURL, onProgress } = params;
  const downloadedAt = new Date().toISOString();
  const metadata: StoredMetadata = {
    boundsNE,
    boundsSW,
    minZoom: OFFLINE_MIN_ZOOM,
    maxZoom: OFFLINE_MAX_ZOOM,
    styleURL,
    downloadedAt,
  };

  await new Promise<void>((resolve, reject) => {
    let lastProgress: DownloadProgress = {
      percentage: 0,
      completedTileCount: 0,
      completedResourceSize: 0,
    };
    void Mapbox.offlineManager
      .createPack(
        {
          name,
          styleURL,
          bounds: [boundsNE, boundsSW],
          minZoom: OFFLINE_MIN_ZOOM,
          maxZoom: OFFLINE_MAX_ZOOM,
          metadata: metadata as unknown as Record<string, unknown>,
        },
        (_pack, status) => {
          lastProgress = {
            percentage: status.percentage,
            completedTileCount: status.completedTileCount,
            completedResourceSize: status.completedResourceSize,
          };
          onProgress?.(lastProgress);
          if (status.percentage >= 100) resolve();
        },
        (_pack, err) => {
          reject(new Error(err.message));
        },
      )
      .catch((err) => reject(err));
  });

  return {
    name,
    boundsNE,
    boundsSW,
    minZoom: OFFLINE_MIN_ZOOM,
    maxZoom: OFFLINE_MAX_ZOOM,
    styleURL,
    downloadedAt,
    sizeBytes: 0,
  };
}

export async function deleteRegion(name: string): Promise<void> {
  await Mapbox.offlineManager.deletePack(name);
}
