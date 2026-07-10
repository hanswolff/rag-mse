// In-process rate-limit store.
//
// This replaces the former Redis-backed store. The application is deployed as a
// single Next.js process on a single host (embedded SQLite database, one
// HAProxy backend), so rate-limit counters can safely live in this process's
// memory instead of an external service.
//
// Keys expire lazily on access and are swept periodically to bound memory use,
// mirroring the TTL semantics that Redis previously provided. The store exposes
// the small subset of Redis string commands that the rate limiter relies on
// (get/set/incr/decr/del/pexpire/pttl/keys) so the rate-limiter logic itself is
// unchanged.
//
// NOTE: counters are intentionally non-persistent — an application restart or
// redeploy resets all rate-limit state. This is an accepted trade-off for the
// single-host deployment.

interface Entry {
  value: string;
  // Epoch milliseconds at which the key expires, or null for no expiry.
  expiresAt: number | null;
}

const SWEEP_INTERVAL_MS = 60 * 1000;

function globToRegExp(pattern: string): RegExp {
  // Only the trailing/embedded "*" wildcard is used by the rate limiter.
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

class RateLimitStore {
  private store = new Map<string, Entry>();

  constructor() {
    if (process.env.NODE_ENV !== "test") {
      const timer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
      // Do not keep the event loop alive solely for the sweep.
      timer.unref?.();
    }
  }

  private isExpired(entry: Entry): boolean {
    return entry.expiresAt !== null && entry.expiresAt <= Date.now();
  }

  private getEntry(key: string): Entry | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  get(key: string): string | null {
    return this.getEntry(key)?.value ?? null;
  }

  set(key: string, value: string, mode?: "PX", ttlMs?: number): "OK" {
    const expiresAt = mode === "PX" && typeof ttlMs === "number" ? Date.now() + ttlMs : null;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  incr(key: string): number {
    const entry = this.getEntry(key);
    if (!entry) {
      this.store.set(key, { value: "1", expiresAt: null });
      return 1;
    }
    // Redis preserves a key's TTL across INCR.
    const next = Number.parseInt(entry.value, 10) + 1;
    entry.value = `${next}`;
    return next;
  }

  decr(key: string): number {
    const entry = this.getEntry(key);
    if (!entry) {
      this.store.set(key, { value: "-1", expiresAt: null });
      return -1;
    }
    const next = Number.parseInt(entry.value, 10) - 1;
    entry.value = `${next}`;
    return next;
  }

  del(key: string): number {
    return this.store.delete(key) ? 1 : 0;
  }

  pexpire(key: string, ttlMs: number): number {
    const entry = this.getEntry(key);
    if (!entry) {
      return 0;
    }
    entry.expiresAt = Date.now() + ttlMs;
    return 1;
  }

  pttl(key: string): number {
    const entry = this.getEntry(key);
    if (!entry) {
      return -2;
    }
    if (entry.expiresAt === null) {
      return -1;
    }
    return Math.max(0, entry.expiresAt - Date.now());
  }

  keys(pattern: string): string[] {
    const regex = globToRegExp(pattern);
    const matches: string[] = [];
    for (const key of this.store.keys()) {
      if (this.getEntry(key) && regex.test(key)) {
        matches.push(key);
      }
    }
    return matches;
  }

  reset(): void {
    this.store.clear();
  }
}

// Prozessweites Singleton auf globalThis (Muster wie lib/prisma.ts): ein modul-
// lokales Singleton würde bei HMR in `next dev` die Zähler zurücksetzen und bei
// duplizierten Modul-Chunks die Per-IP-Zähler splitten.
const globalForRateLimit = globalThis as typeof globalThis & {
  rateLimitStoreInstance?: RateLimitStore;
};

export function getRateLimitStore(): RateLimitStore {
  if (!globalForRateLimit.rateLimitStoreInstance) {
    globalForRateLimit.rateLimitStoreInstance = new RateLimitStore();
  }
  return globalForRateLimit.rateLimitStoreInstance;
}

export function resetRateLimitStore(): void {
  globalForRateLimit.rateLimitStoreInstance?.reset();
}
