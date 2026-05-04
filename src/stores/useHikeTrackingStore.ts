import { create } from 'zustand';

import {
  boundingBox,
  currentPaceSecPerKm,
  haversineMeters,
  pathDistanceMeters,
} from '@/lib/geo';
import type {
  BoundingBox,
  HikePoint,
  HikeStats,
  HikeStatus,
} from '@/types/hike';

const ELEVATION_NOISE_FLOOR_M = 3;

type PersistedHike = {
  startedAt: number;
  pausedAt: number | null;
  accumulatedPausedMs: number;
  points: HikePoint[];
};

/**
 * Walk a path computing gain/loss + the "running reference altitude" for
 * the smoothed elevation algorithm. Used when hydrating from persistence
 * — addPoint maintains these incrementally on the hot path.
 */
function recomputeElevation(points: HikePoint[]): {
  gain: number;
  loss: number;
  referenceAltitude: number | null;
} {
  let gain = 0;
  let loss = 0;
  let referenceAltitude: number | null = null;
  for (const p of points) {
    if (p.altitude === null) continue;
    if (referenceAltitude === null) {
      referenceAltitude = p.altitude;
      continue;
    }
    const delta = p.altitude - referenceAltitude;
    if (Math.abs(delta) < ELEVATION_NOISE_FLOOR_M) continue;
    if (delta > 0) gain += delta;
    else loss += -delta;
    referenceAltitude = p.altitude;
  }
  return { gain, loss, referenceAltitude };
}

type DraftHike = {
  startedAtMs: number;
  endedAtMs: number;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  path: HikePoint[];
  bounding_box: BoundingBox;
};

type HikeTrackingState = {
  status: HikeStatus;
  points: HikePoint[];
  startedAt: number | null;
  pausedAt: number | null;
  accumulatedPausedMs: number;
  stats: HikeStats;
  // Incremental running state — never re-scanned from scratch.
  referenceAltitude: number | null;

  startHike: () => void;
  pauseHike: () => void;
  resumeHike: () => void;
  addPoint: (point: HikePoint) => void;
  finalizeHike: () => DraftHike | null;
  markSaving: () => void;
  resetHike: () => void;
  restoreFromPersistence: (data: PersistedHike) => void;
  mergePersistedPoints: (points: HikePoint[]) => void;
};

const EMPTY_STATS: HikeStats = {
  distanceMeters: 0,
  durationSeconds: 0,
  elevationGainMeters: 0,
  elevationLossMeters: 0,
  currentPaceSecPerKm: null,
};

export const useHikeTrackingStore = create<HikeTrackingState>((set, get) => ({
  status: 'idle',
  points: [],
  startedAt: null,
  pausedAt: null,
  accumulatedPausedMs: 0,
  stats: EMPTY_STATS,
  referenceAltitude: null,

  startHike: (): void => {
    set({
      status: 'tracking',
      points: [],
      startedAt: Date.now(),
      pausedAt: null,
      accumulatedPausedMs: 0,
      stats: EMPTY_STATS,
      referenceAltitude: null,
    });
  },

  pauseHike: (): void => {
    if (get().status !== 'tracking') return;
    set({ status: 'paused', pausedAt: Date.now() });
  },

  resumeHike: (): void => {
    const { status, pausedAt, accumulatedPausedMs } = get();
    if (status !== 'paused' || pausedAt === null) return;
    set({
      status: 'tracking',
      pausedAt: null,
      accumulatedPausedMs: accumulatedPausedMs + (Date.now() - pausedAt),
    });
  },

  addPoint: (point: HikePoint): void => {
    const state = get();
    if (state.status !== 'tracking' || state.startedAt === null) return;

    const points = [...state.points, point];

    // Incremental distance: only haversine the new segment.
    const prev = state.points[state.points.length - 1];
    const segmentMeters = prev ? haversineMeters(prev, point) : 0;
    const distanceMeters = state.stats.distanceMeters + segmentMeters;

    // Incremental elevation with noise floor.
    let gain = state.stats.elevationGainMeters;
    let loss = state.stats.elevationLossMeters;
    let referenceAltitude = state.referenceAltitude;
    if (point.altitude !== null) {
      if (referenceAltitude === null) {
        referenceAltitude = point.altitude;
      } else {
        const delta = point.altitude - referenceAltitude;
        if (Math.abs(delta) >= ELEVATION_NOISE_FLOOR_M) {
          if (delta > 0) gain += delta;
          else loss += -delta;
          referenceAltitude = point.altitude;
        }
      }
    }

    const durationSeconds =
      (point.timestamp - state.startedAt - state.accumulatedPausedMs) / 1000;

    set({
      points,
      referenceAltitude,
      stats: {
        distanceMeters,
        durationSeconds: Math.max(0, durationSeconds),
        elevationGainMeters: gain,
        elevationLossMeters: loss,
        currentPaceSecPerKm: currentPaceSecPerKm(points),
      },
    });
  },

  finalizeHike: (): DraftHike | null => {
    const { points, startedAt, accumulatedPausedMs, stats } = get();
    if (startedAt === null || points.length === 0) return null;
    const endedAtMs = Date.now();
    const durationSeconds = Math.max(
      0,
      Math.round((endedAtMs - startedAt - accumulatedPausedMs) / 1000),
    );
    return {
      startedAtMs: startedAt,
      endedAtMs,
      durationSeconds,
      distanceMeters: stats.distanceMeters,
      elevationGainMeters: stats.elevationGainMeters,
      elevationLossMeters: stats.elevationLossMeters,
      path: points,
      bounding_box: boundingBox(points),
    };
  },

  markSaving: (): void => {
    set({ status: 'saving' });
  },

  resetHike: (): void => {
    set({
      status: 'idle',
      points: [],
      startedAt: null,
      pausedAt: null,
      accumulatedPausedMs: 0,
      stats: EMPTY_STATS,
      referenceAltitude: null,
    });
  },

  restoreFromPersistence: (data: PersistedHike): void => {
    const elevation = recomputeElevation(data.points);
    const distanceMeters = pathDistanceMeters(data.points);
    const isPaused = data.pausedAt !== null;
    const liveDurationMs = isPaused
      ? (data.pausedAt as number) - data.startedAt - data.accumulatedPausedMs
      : Date.now() - data.startedAt - data.accumulatedPausedMs;
    set({
      status: isPaused ? 'paused' : 'tracking',
      points: data.points,
      startedAt: data.startedAt,
      pausedAt: data.pausedAt,
      accumulatedPausedMs: data.accumulatedPausedMs,
      referenceAltitude: elevation.referenceAltitude,
      stats: {
        distanceMeters,
        durationSeconds: Math.max(0, liveDurationMs / 1000),
        elevationGainMeters: elevation.gain,
        elevationLossMeters: elevation.loss,
        currentPaceSecPerKm: currentPaceSecPerKm(data.points),
      },
    });
  },

  mergePersistedPoints: (points: HikePoint[]): void => {
    const state = get();
    if (state.startedAt === null) return;
    if (points.length <= state.points.length) return;
    const elevation = recomputeElevation(points);
    const distanceMeters = pathDistanceMeters(points);
    const last = points[points.length - 1];
    const durationSeconds =
      (last.timestamp - state.startedAt - state.accumulatedPausedMs) / 1000;
    set({
      points,
      referenceAltitude: elevation.referenceAltitude,
      stats: {
        distanceMeters,
        durationSeconds: Math.max(0, durationSeconds),
        elevationGainMeters: elevation.gain,
        elevationLossMeters: elevation.loss,
        currentPaceSecPerKm: currentPaceSecPerKm(points),
      },
    });
  },
}));
