import { File, Paths } from 'expo-file-system';

import type { BoundingBox, HikePoint } from '@/types/hike';

const FILE_NAME = 'hike-outbox.json';

/**
 * RFC 4122 v4 UUID using Math.random. Not cryptographic — uniqueness is
 * sufficient for outbox row ids that share identity with their eventual
 * Supabase row.
 */
export function uuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Shape of the row we send to Supabase's `hikes` table. The id is
 * client-generated so the local outbox identity equals the server row
 * identity once synced — viewing/refetching is consistent across the
 * sync boundary.
 */
export interface OutboxedHikePayload {
  id: string;
  user_id: string;
  name: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  distance_meters: number;
  elevation_gain_meters: number;
  elevation_loss_meters: number;
  path: HikePoint[];
  bounding_box: BoundingBox;
}

export interface OutboxedHike {
  id: string;
  hike: OutboxedHikePayload;
  queuedAt: number;
  lastAttemptAt: number | null;
  attemptCount: number;
  lastError: string | null;
}

function getFile(): File {
  return new File(Paths.document, FILE_NAME);
}

// Single-thread writes — both the outbox sync hook and the StopHike modal
// can mutate concurrently. Same chained-Promise pattern Phase 4.5 uses
// for in-progress hike persistence.
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueueWork<T>(work: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(work, work);
  writeQueue = next.catch(() => undefined);
  return next;
}

async function readFile(): Promise<OutboxedHike[]> {
  const file = getFile();
  if (!file.exists) return [];
  try {
    const raw = await file.text();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboxedHike[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.warn('[hikeOutbox] read failed:', err);
    return [];
  }
}

function writeFile(items: OutboxedHike[]): void {
  const file = getFile();
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(items));
}

export function getOutbox(): Promise<OutboxedHike[]> {
  return enqueueWork(() => readFile());
}

export function enqueue(payload: OutboxedHikePayload): Promise<string> {
  return enqueueWork(async () => {
    const items = await readFile();
    const next: OutboxedHike = {
      id: payload.id,
      hike: payload,
      queuedAt: Date.now(),
      lastAttemptAt: null,
      attemptCount: 0,
      lastError: null,
    };
    writeFile([...items, next]);
    return payload.id;
  });
}

export function dequeue(id: string): Promise<void> {
  return enqueueWork(async () => {
    const items = await readFile();
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) return;
    writeFile(next);
  });
}

export function markAttemptFailed(
  id: string,
  errorMessage: string,
): Promise<void> {
  return enqueueWork(async () => {
    const items = await readFile();
    const next = items.map((item) =>
      item.id === id
        ? {
            ...item,
            lastAttemptAt: Date.now(),
            attemptCount: item.attemptCount + 1,
            lastError: errorMessage,
          }
        : item,
    );
    writeFile(next);
  });
}

export function clearOutbox(): Promise<void> {
  return enqueueWork(async () => {
    const file = getFile();
    if (file.exists) file.delete();
  });
}
