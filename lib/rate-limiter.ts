import { getRateLimitStore } from "./rate-limit-store";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const IP_WINDOW_MS = 15 * 60 * 1000;
const TOKEN_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_ATTEMPTS = 25;
const TOKEN_READ_IP_WINDOW_MS = 15 * 60 * 1000;
const TOKEN_READ_IP_MAX_ATTEMPTS = 100;

const LOGIN_ATTEMPT_THRESHOLDS = [
  { attempts: 6, blockDuration: 1 * 60 * 1000 },
  { attempts: 11, blockDuration: 5 * 60 * 1000 },
  { attempts: 16, blockDuration: 15 * 60 * 1000 },
  { attempts: 21, blockDuration: 60 * 60 * 1000 },
];

const TOKEN_ATTEMPT_THRESHOLDS = [
  { attempts: 4, blockDuration: 5 * 60 * 1000 },
  { attempts: 7, blockDuration: 15 * 60 * 1000 },
  { attempts: 10, blockDuration: 60 * 60 * 1000 },
];

// Status-Lookups (GET) laufen bei jedem Seitenaufruf — teilen sie sich das knappe
// Einlöse-Budget oder das IP-Limit, sperren Seitenaufrufe Eingeladene bzw. ganze
// NAT-Netze aus. Sie zählen daher nur auf dieses eigene Budget (pro Token und
// großzügig pro IP gegen Enumeration mit ständig neuen Tokens); Einlöseversuche
// (POST) bleiben am IP-Limit.
const TOKEN_READ_ATTEMPT_THRESHOLDS = [
  { attempts: 30, blockDuration: 15 * 60 * 1000 },
  { attempts: 60, blockDuration: 60 * 60 * 1000 },
];

const FORGOT_PASSWORD_ATTEMPT_THRESHOLDS = [
  { attempts: 3, blockDuration: 15 * 60 * 1000 },
  { attempts: 6, blockDuration: 60 * 60 * 1000 },
  { attempts: 10, blockDuration: 24 * 60 * 60 * 1000 },
];

const RATE_LIMIT_PREFIX = "ratelimit:";
const IP_PREFIX = `${RATE_LIMIT_PREFIX}ip:`;
const LOGIN_PREFIX = `${RATE_LIMIT_PREFIX}login:`;
const TOKEN_PREFIX = `${RATE_LIMIT_PREFIX}token:`;
const TOKEN_READ_PREFIX = `${RATE_LIMIT_PREFIX}token-read:`;
const TOKEN_READ_IP_PREFIX = `${RATE_LIMIT_PREFIX}token-read-ip:`;
const FORGOT_PASSWORD_PREFIX = `${RATE_LIMIT_PREFIX}forgot:`;
const CONTACT_PREFIX = `${RATE_LIMIT_PREFIX}contact:`;
const GEOCODE_PREFIX = `${RATE_LIMIT_PREFIX}geocode:`;
const BLOCKED_UNTIL_PREFIX = `${RATE_LIMIT_PREFIX}blocked:`;

async function deleteRateLimitEntry(key: string): Promise<void> {
  const store = getRateLimitStore();
  store.del(key);
}

async function getCounterValue(key: string): Promise<number> {
  const store = getRateLimitStore();
  const value = store.get(key);
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function incrementFixedWindowCounter(key: string, windowMs: number): Promise<number> {
  const store = getRateLimitStore();
  const count = store.incr(key);

  if (count === 1) {
    store.pexpire(key, windowMs);
  }

  return count;
}

async function decrementCounter(key: string): Promise<void> {
  const store = getRateLimitStore();
  const decremented = store.decr(key);

  if (decremented <= 0) {
    store.del(key);
  }
}

async function decrementIpCounter(ip: string): Promise<void> {
  await decrementCounter(`${IP_PREFIX}${ip}`);
}

export interface RateLimitResult {
  allowed: boolean;
  blockedUntil?: number;
  attemptCount: number;
}

export interface FixedWindowAttemptResult {
  allowed: boolean;
  attemptCount: number;
}

interface ThresholdConfig {
  attempts: number;
  blockDuration: number;
}

interface IpBudget {
  prefix: string;
  windowMs: number;
  maxAttempts: number;
}

const IP_BUDGET: IpBudget = { prefix: IP_PREFIX, windowMs: IP_WINDOW_MS, maxAttempts: IP_MAX_ATTEMPTS };
const TOKEN_READ_IP_BUDGET: IpBudget = {
  prefix: TOKEN_READ_IP_PREFIX,
  windowMs: TOKEN_READ_IP_WINDOW_MS,
  maxAttempts: TOKEN_READ_IP_MAX_ATTEMPTS,
};

async function incrementIpAttempt(ip: string, now: number, budget: IpBudget = IP_BUDGET): Promise<RateLimitResult> {
  const ipKey = `${budget.prefix}${ip}`;
  const count = await incrementFixedWindowCounter(ipKey, budget.windowMs);

  if (count > budget.maxAttempts) {
    await decrementCounter(ipKey);
    const remainingMs = getRateLimitStore().pttl(ipKey);
    return {
      allowed: false,
      blockedUntil: remainingMs > 0 ? now + remainingMs : undefined,
      attemptCount: budget.maxAttempts,
    };
  }

  return { allowed: true, attemptCount: count };
}

// Zwischenstufen sperren nur beim genauen Erreichen; ab der letzten Stufe sperrt
// jeder weitere Versuch nach Ablauf erneut für deren volle Dauer, bis das
// Zählerfenster ausläuft oder ein Erfolg zurücksetzt.
function findReachedThreshold(attemptCount: number, thresholds: ThresholdConfig[]): ThresholdConfig | undefined {
  const lastThreshold = thresholds[thresholds.length - 1];
  if (lastThreshold && attemptCount >= lastThreshold.attempts) {
    return lastThreshold;
  }
  return thresholds.find((threshold) => threshold.attempts === attemptCount);
}

async function checkRateLimit(
  keyPrefix: string,
  keySuffix: string,
  now: number,
  windowMs: number,
  thresholds: ThresholdConfig[],
  ip: string,
  ipBudget: IpBudget = IP_BUDGET
): Promise<RateLimitResult> {
  const ipAttempt = await incrementIpAttempt(ip, now, ipBudget);
  if (!ipAttempt.allowed) {
    return ipAttempt;
  }

  const key = `${keyPrefix}${keySuffix}`;
  const blockedUntilKey = `${BLOCKED_UNTIL_PREFIX}${keyPrefix}${keySuffix}`;
  const store = getRateLimitStore();
  const blockedUntilRaw = store.get(blockedUntilKey);
  const blockedUntil = blockedUntilRaw ? Number.parseInt(blockedUntilRaw, 10) : NaN;

  if (Number.isFinite(blockedUntil) && blockedUntil > now) {
    return { allowed: false, blockedUntil, attemptCount: await getCounterValue(key) };
  }

  const attemptCount = await incrementFixedWindowCounter(key, windowMs);

  const reached = findReachedThreshold(attemptCount, thresholds);
  if (reached) {
    const nextBlockedUntil = now + reached.blockDuration;
    store.set(blockedUntilKey, `${nextBlockedUntil}`, "PX", reached.blockDuration);
    store.pexpire(key, Math.max(store.pttl(key), reached.blockDuration + windowMs));
    return { allowed: false, blockedUntil: nextBlockedUntil, attemptCount };
  }

  return { allowed: true, attemptCount };
}

async function checkFixedWindowRateLimit(
  keyPrefix: string,
  keySuffix: string,
  windowMs: number,
  maxAttempts: number
): Promise<FixedWindowAttemptResult> {
  const key = `${keyPrefix}${keySuffix}`;
  const currentCount = await incrementFixedWindowCounter(key, windowMs);

  return {
    allowed: currentCount <= maxAttempts,
    attemptCount: currentCount,
  };
}

export async function checkLoginRateLimit(ip: string, email?: string): Promise<RateLimitResult> {
  const now = Date.now();
  if (!email) {
    return incrementIpAttempt(ip, now);
  }

  const key = `${ip}:${email.toLowerCase()}`;
  return checkRateLimit(LOGIN_PREFIX, key, now, LOGIN_WINDOW_MS, LOGIN_ATTEMPT_THRESHOLDS, ip);
}

export async function recordSuccessfulLogin(ip: string, email: string): Promise<void> {
  const key = `${LOGIN_PREFIX}${ip}:${email.toLowerCase()}`;
  await deleteRateLimitEntry(key);
  await deleteRateLimitEntry(`${BLOCKED_UNTIL_PREFIX}${key}`);
  await decrementIpCounter(ip);
}

export async function checkTokenRateLimit(ip: string, tokenHash: string): Promise<RateLimitResult> {
  const now = Date.now();
  return checkRateLimit(TOKEN_PREFIX, tokenHash, now, TOKEN_WINDOW_MS, TOKEN_ATTEMPT_THRESHOLDS, ip);
}

export async function checkTokenReadRateLimit(ip: string, tokenHash: string): Promise<RateLimitResult> {
  const now = Date.now();
  return checkRateLimit(
    TOKEN_READ_PREFIX,
    tokenHash,
    now,
    TOKEN_WINDOW_MS,
    TOKEN_READ_ATTEMPT_THRESHOLDS,
    ip,
    TOKEN_READ_IP_BUDGET
  );
}

export async function recordSuccessfulTokenUsage(tokenHash: string, ip: string): Promise<void> {
  const tokenKey = `${TOKEN_PREFIX}${tokenHash}`;
  const tokenReadKey = `${TOKEN_READ_PREFIX}${tokenHash}`;
  await deleteRateLimitEntry(tokenKey);
  await deleteRateLimitEntry(`${BLOCKED_UNTIL_PREFIX}${tokenKey}`);
  await deleteRateLimitEntry(tokenReadKey);
  await deleteRateLimitEntry(`${BLOCKED_UNTIL_PREFIX}${tokenReadKey}`);
  await decrementIpCounter(ip);
}

export async function checkForgotPasswordRateLimit(ip: string, email: string): Promise<RateLimitResult> {
  const now = Date.now();
  const key = `${ip}:${email.toLowerCase()}`;
  return checkRateLimit(FORGOT_PASSWORD_PREFIX, key, now, FORGOT_PASSWORD_WINDOW_MS, FORGOT_PASSWORD_ATTEMPT_THRESHOLDS, ip);
}

export async function checkContactRateLimit(clientId: string, windowMs: number, maxAttempts: number): Promise<FixedWindowAttemptResult> {
  return checkFixedWindowRateLimit(CONTACT_PREFIX, clientId, windowMs, maxAttempts);
}

export async function checkGeocodeRateLimit(clientId: string, windowMs: number, maxAttempts: number): Promise<FixedWindowAttemptResult> {
  return checkFixedWindowRateLimit(GEOCODE_PREFIX, clientId, windowMs, maxAttempts);
}

export async function resetRateLimitForTesting(): Promise<void> {
  const { resetRateLimitStore } = await import("./rate-limit-store");
  resetRateLimitStore();
}
