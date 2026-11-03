import "server-only";

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/**
 * Sliding-window limiter kept in memory. Good enough for a single-instance
 * self-hosted service; returns the seconds to wait when the limit is hit.
 */
export function rateLimit(key: string, limit: number, windowMs: number): number {
  const now = Date.now();
  if (now - lastSweep > 60_000) sweep(now, windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    return Math.ceil((bucket.hits[0]! + windowMs - now) / 1000);
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return 0;
}

function sweep(now: number, windowMs: number) {
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.every((t) => now - t >= windowMs)) buckets.delete(key);
  }
}
