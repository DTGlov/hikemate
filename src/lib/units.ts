export type UnitSystem = 'metric' | 'imperial';

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "2.34 km" or "1.45 mi". */
export function formatDistance(meters: number, system: UnitSystem): string {
  if (!Number.isFinite(meters) || meters < 0) meters = 0;
  if (system === 'imperial') {
    const miles = meters / METERS_PER_MILE;
    return `${miles.toFixed(2)} mi`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/** "120 m" or "394 ft" (rounded to whole units). */
export function formatElevation(meters: number, system: UnitSystem): string {
  if (!Number.isFinite(meters) || meters < 0) meters = 0;
  if (system === 'imperial') {
    return `${Math.round(meters * FEET_PER_METER)} ft`;
  }
  return `${Math.round(meters)} m`;
}

/** "8:42 /km" or "14:00 /mi". null seconds → "—". */
export function formatPace(
  secondsPerKm: number | null,
  system: UnitSystem,
): string {
  const suffix = system === 'imperial' ? '/mi' : '/km';
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm)) {
    return `—:— ${suffix}`;
  }
  const secondsPerUnit =
    system === 'imperial'
      ? secondsPerKm * (METERS_PER_MILE / 1000)
      : secondsPerKm;
  if (secondsPerUnit < 0 || !Number.isFinite(secondsPerUnit)) {
    return `—:— ${suffix}`;
  }
  const minutes = Math.floor(secondsPerUnit / 60);
  const seconds = Math.round(secondsPerUnit % 60);
  return `${minutes}:${pad2(seconds)} ${suffix}`;
}

/** "1:23:45" for ≥1h, otherwise "M:SS". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${m}:${pad2(s)}`;
}
