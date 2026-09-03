interface Bucket {
  hits: number[];
  dayKey: string;
  dayCount: number;
  lastHitAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingInWindow: number;
  remainingToday: number;
}

const buckets = new Map<string, Bucket>();
const globalHits: number[] = [];

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function currentDayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function checkRateLimit(key: string, now = Date.now()): RateLimitDecision {
  const windowMinutes = envInt("TRACEDESK_RATE_WINDOW_MINUTES", 15, 1, 60);
  const maxRequests = envInt("TRACEDESK_RATE_MAX_REQUESTS", 6, 1, 30);
  const dailyMax = envInt("TRACEDESK_DAILY_MAX_REQUESTS", 20, 1, 100);
  const cooldownSeconds = envInt("TRACEDESK_COOLDOWN_SECONDS", 12, 1, 120);
  const windowMs = windowMinutes * 60_000;
  const cutoff = now - windowMs;

  while (globalHits.length > 0 && globalHits[0] < cutoff) globalHits.shift();

  // Per-instance global circuit breaker.
  // The OpenAI organization hard-spend limit is the final backstop.
  if (globalHits.length >= 60) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((globalHits[0] + windowMs - now) / 1000)
    );

    return {
      allowed: false,
      retryAfterSeconds,
      remainingInWindow: 0,
      remainingToday: 0
    };
  }

  const dayKey = currentDayKey(now);
  const existing = buckets.get(key) ?? {
    hits: [],
    dayKey,
    dayCount: 0,
    lastHitAt: 0
  };

  existing.hits = existing.hits.filter((timestamp) => timestamp >= cutoff);

  if (existing.dayKey !== dayKey) {
    existing.dayKey = dayKey;
    existing.dayCount = 0;
  }

  const sinceLast = now - existing.lastHitAt;

  if (existing.lastHitAt > 0 && sinceLast < cooldownSeconds * 1000) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((cooldownSeconds * 1000 - sinceLast) / 1000)
    );

    buckets.set(key, existing);

    return {
      allowed: false,
      retryAfterSeconds,
      remainingInWindow: Math.max(0, maxRequests - existing.hits.length),
      remainingToday: Math.max(0, dailyMax - existing.dayCount)
    };
  }

  if (existing.hits.length >= maxRequests) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.hits[0] + windowMs - now) / 1000)
    );

    buckets.set(key, existing);

    return {
      allowed: false,
      retryAfterSeconds,
      remainingInWindow: 0,
      remainingToday: Math.max(0, dailyMax - existing.dayCount)
    };
  }

  if (existing.dayCount >= dailyMax) {
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((tomorrow.getTime() - now) / 1000)
    );

    buckets.set(key, existing);

    return {
      allowed: false,
      retryAfterSeconds,
      remainingInWindow: 0,
      remainingToday: 0
    };
  }

  existing.hits.push(now);
  existing.dayCount += 1;
  existing.lastHitAt = now;

  globalHits.push(now);
  buckets.set(key, existing);

  // Keep memory bounded in long-lived dev/server processes.
  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.hits.length === 0 && bucket.dayKey !== dayKey) {
        buckets.delete(bucketKey);
      }

      if (buckets.size <= 4000) break;
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingInWindow: Math.max(0, maxRequests - existing.hits.length),
    remainingToday: Math.max(0, dailyMax - existing.dayCount)
  };
}
