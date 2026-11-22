import "server-only";
import { headers } from "next/headers";

/**
 * A small in-memory sliding-window limiter for the public donation form.
 * It isn't meant to stop a determined attacker (put a proper WAF in front
 * for that) — it stops accidental double-submits and casual spamming of
 * pending donations. Per-process, so it resets on restart.
 */
const hits = new Map<string, number[]>();

export async function clientKey(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || h.get("x-real-ip") || "local";
}

export function rateLimited(key: string, limit = 8, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return false;
}
