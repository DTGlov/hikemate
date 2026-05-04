// 8 distinct, hiking-friendly colors. Order matters for stable hash → index
// mapping; do not reorder casually.
export const MEMBER_COLOR_PALETTE = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
] as const;

export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return MEMBER_COLOR_PALETTE[Math.abs(hash) % MEMBER_COLOR_PALETTE.length];
}
