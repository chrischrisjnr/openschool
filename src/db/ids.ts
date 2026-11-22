import { randomBytes } from "node:crypto";

// Crockford-style alphabet: no 0/O/1/I/L confusion when read aloud or typed.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** Random id, e.g. "k7m2x9qfp4hd3wza". 16 chars ≈ 79 bits of entropy. */
export function newId(length = 16): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/** Short human-friendly code, e.g. for QR links: "h7kq3m". */
export function shortCode(length = 6): string {
  return newId(length);
}
