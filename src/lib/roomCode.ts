import { customAlphabet } from 'nanoid/non-secure';

// Visually unambiguous: drop 0/O/1/I/L. The remaining 31-char alphabet is
// big enough that 6-char codes give ~887M combinations — collision risk is
// fine for our scale, and the create flow retries on unique violations.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const generate = customAlphabet(ALPHABET, 6);

export function generateRoomCode(): string {
  return generate();
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== 6) return false;
  for (const ch of code) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}
