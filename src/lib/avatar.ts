/**
 * DiceBear "bottts" avatars — playful robot identities, gender-neutral,
 * deterministic per seed, free, no API key required at our scale.
 * SVG output renders crisply at any size.
 */
export function avatarUrl(seed: string, size: number = 200): string {
  const safeSeed = encodeURIComponent(seed);
  const safeSize = Math.max(16, Math.min(512, Math.floor(size * 2)));
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${safeSeed}&size=${safeSize}`;
}
