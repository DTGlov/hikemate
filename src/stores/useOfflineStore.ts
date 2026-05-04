import { create } from 'zustand';

export interface OfflineRegionMeta {
  /** Stable display name; also the Mapbox pack identifier. */
  name: string;
  /** [neLng, neLat] / [swLng, swLat] — Mapbox convention. */
  boundsNE: [number, number];
  boundsSW: [number, number];
  minZoom: number;
  maxZoom: number;
  styleURL: string;
  /** ISO string. */
  downloadedAt: string;
  /** Approximate completed resource bytes from last known progress. */
  sizeBytes: number;
}

const FREE_DOWNLOAD_LIMIT = 3;

type OfflineState = {
  isOnline: boolean;
  outboxCount: number;
  regions: OfflineRegionMeta[];
  regionsLoaded: boolean;

  setOnline: (next: boolean) => void;
  setOutboxCount: (next: number) => void;
  setRegions: (regions: OfflineRegionMeta[]) => void;
  freeSlotsRemaining: () => number;
};

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: true, // optimistic default; useOnlineState corrects on mount
  outboxCount: 0,
  regions: [],
  regionsLoaded: false,

  setOnline: (next): void => set({ isOnline: next }),
  setOutboxCount: (next): void => set({ outboxCount: next }),
  setRegions: (regions): void => set({ regions, regionsLoaded: true }),
  freeSlotsRemaining: (): number =>
    Math.max(0, FREE_DOWNLOAD_LIMIT - get().regions.length),
}));

export const OFFLINE_FREE_DOWNLOAD_LIMIT = FREE_DOWNLOAD_LIMIT;
