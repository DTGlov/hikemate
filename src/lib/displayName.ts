/** "test8@gmail.com" → "test8". Returns input unchanged if no @ found. */
export function emailToDisplayName(email: string): string {
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

/**
 * Initials for an avatar circle. Multi-word names use first + last word's
 * first letter ("Dave Glover" → "DG"). Single-word names use the first
 * two characters ("test8" → "TE"). Empty / whitespace input falls back
 * to "?".
 */
export function initialsFromDisplayName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
