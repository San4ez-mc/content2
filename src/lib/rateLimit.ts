// Простий in-memory sliding-window rate-limiter (#312).
// content2 працює як довгоживучий Node-процес (next start), тож module-стан зберігається.
// Захищає дорогі бот-операції (генерація зображень) від зациклення/зловживання секретом.
type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

let lastSweep = 0;
function sweep(now: number, windowMs: number) {
  // періодове прибирання старих ключів, щоб мапа не росла
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  Array.from(buckets.keys()).forEach((key) => {
    const b = buckets.get(key)!;
    b.hits = b.hits.filter((t: number) => now - t < windowMs);
    if (b.hits.length === 0) buckets.delete(key);
  });
}

export type RateResult = { ok: boolean; remaining: number; retryAfterSec: number };

/** Дозволити не більше `limit` подій на `key` у вікні `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now, windowMs);
  let b = buckets.get(key);
  if (!b) { b = { hits: [] }; buckets.set(key, b); }
  b.hits = b.hits.filter((t: number) => now - t < windowMs);
  if (b.hits.length >= limit) {
    const oldest = b.hits[0];
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }
  b.hits.push(now);
  return { ok: true, remaining: limit - b.hits.length, retryAfterSec: 0 };
}
