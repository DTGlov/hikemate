import type * as Location from 'expo-location';
import { File, Paths } from 'expo-file-system';

import type { HikePoint } from '@/types/hike';

export interface InProgressHike {
  startedAt: number;
  pausedAt: number | null;
  accumulatedPausedMs: number;
  points: HikePoint[];
}

const FILE_NAME = 'in-progress-hike.json';

function getFile(): File {
  return new File(Paths.document, FILE_NAME);
}

// Single-thread the writes. Both the foreground store and the TaskManager
// task may call append/clear; chaining onto this promise keeps reads and
// writes from interleaving across an await boundary.
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(work, work);
  writeQueue = next.catch(() => undefined);
  return next;
}

async function readFile(): Promise<InProgressHike | null> {
  const file = getFile();
  if (!file.exists) return null;
  try {
    const raw = await file.text();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InProgressHike;
    if (
      typeof parsed.startedAt !== 'number' ||
      typeof parsed.accumulatedPausedMs !== 'number' ||
      !Array.isArray(parsed.points)
    ) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn('[hikePersistence] Failed to read in-progress hike:', err);
    return null;
  }
}

function writeFile(hike: InProgressHike): void {
  const file = getFile();
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(hike));
}

export function getInProgressHike(): Promise<InProgressHike | null> {
  return enqueue(() => readFile());
}

export function setInProgressHike(hike: InProgressHike): Promise<void> {
  return enqueue(async () => {
    writeFile(hike);
  });
}

/**
 * Append a batch of raw OS LocationObjects to the persisted hike. The task
 * manager hands us LocationObjects; we map them to the typed HikePoint form
 * here so the task itself stays minimal.
 *
 * Skips the append if no in-progress hike exists, or the hike is currently
 * paused — defensive in case the OS holds onto a queued event after we
 * called stopLocationUpdatesAsync.
 */
export function appendPointsToInProgressHike(
  locations: Location.LocationObject[],
): Promise<void> {
  return enqueue(async () => {
    const current = await readFile();
    if (!current) return;
    if (current.pausedAt !== null) return;

    const newPoints: HikePoint[] = locations.map((loc) => ({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude:
        typeof loc.coords.altitude === 'number' ? loc.coords.altitude : null,
      timestamp: loc.timestamp,
    }));

    writeFile({
      ...current,
      points: [...current.points, ...newPoints],
    });
  });
}

export function clearInProgressHike(): Promise<void> {
  return enqueue(async () => {
    const file = getFile();
    if (file.exists) file.delete();
  });
}
