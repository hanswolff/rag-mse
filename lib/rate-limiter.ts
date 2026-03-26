import { getRedisClient } from "./redis-client";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const IP_WINDOW_MS = 15 * 60 * 1000;
const TOKEN_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_ATTEMPTS = 25;

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

const FORGOT_PASSWORD_ATTEMPT_THRESHOLDS = [
  { attempts: 3, blockDuration: 15 * 60 * 1000 },
  { attempts: 6, blockDuration: 60 * 60 * 1000 },
  { attempts: 10, blockDuration: 24 * 60 * 60 * 1000 },
];

const RATE_LIMIT_PREFIX = "ratelimit:";
const IP_PREFIX = `${RATE_LIMIT_PREFIX}ip:`;
const LOGIN_PREFIX = `${RATE_LIMIT_PREFIX}login:`;
const TOKEN_PREFIX = `${RATE_LIMIT_PREFIX}token:`;
const FORGOT_PASSWORD_PREFIX = `${RATE_LIMIT_PREFIX}forgot:`;
const CONTACT_PREFIX = `${RATE_LIMIT_PREFIX}contact:`;
const GEOCODE_PREFIX = `${RATE_LIMIT_PREFIX}geocode:`;
const BLOCKED_UNTIL_PREFIX = `${RATE_LIMIT_PREFIX}blocked:`;

async function deleteRateLimitEntry(key: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(key);
}

async function getCounterValue(key: string): Promise<number> {
  const redis = getRedisClient();
  const value = await redis.get(key);
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function incrementFixedWindowCounter(key: string, windowMs: number): Promise<number> {
  const redis = getRedisClient();
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.pexpire(key, windowMs);
  }

  return count;
}

async function decrementIpCounter(ip: string): Promise<void> {
  const ipKey = `${IP_PREFIX}${ip}`;
  const redis = getRedisClient();
  const decremented = await redis.decr(ipKey);

  if (decremented <= 0) {
    await redis.del(ipKey);
  }
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

async function incrementIpAttempt(ip: string): Promise<{ allowed: boolean; attemptCount: number }> {
  const ipKey = `${IP_PREFIX}${ip}`;
  const count = await incrementFixedWindowCounter(ipKey, IP_WINDOW_MS);

  if (count > IP_MAX_ATTEMPTS) {
    await decrementIpCounter(ip);
    return { allowed: false, attemptCount: IP_MAX_ATTEMPTS };
  }

  return { allowed: true, attemptCount: count };
}

function checkThresholds(attemptCount: number, thresholds: ThresholdConfig[]): number {
  let blockDuration = 0;
  for (const threshold of thresholds) {
    if (attemptCount >= threshold.attempts) {
      blockDuration = threshold.blockDuration;
    }
  }
  return blockDuration;
}

async function checkRateLimit(
  keyPrefix: string,
  keySuffix: string,
  now: number,
  windowMs: number,
  thresholds: ThresholdConfig[],
  ip: string
): Promise<{ allowed: boolean; blockedUntil?: number; attemptCount: number }> {
  const ipAttempt = await incrementIpAttempt(ip);
  if (!ipAttempt.allowed) {
    return { allowed: false, attemptCount: ipAttempt.attemptCount };
  }

  const key = `${keyPrefix}${keySuffix}`;
  const blockedUntilKey = `${BLOCKED_UNTIL_PREFIX}${keyPrefix}${keySuffix}`;
  const redis = getRedisClient();
  const blockedUntilRaw = await redis.get(blockedUntilKey);
  const blockedUntil = blockedUntilRaw ? Number.parseInt(blockedUntilRaw, 10) : NaN;
  const currentCount = await getCounterValue(key);

  if (Number.isFinite(blockedUntil) && blockedUntil > now) {
    return { allowed: false, blockedUntil, attemptCount: currentCount };
  }

  const attemptCount = await incrementFixedWindowCounter(key, windowMs);

  const blockDuration = checkThresholds(attemptCount, thresholds);
  if (blockDuration > 0) {
    const nextBlockedUntil = now + blockDuration;
    const counterTtlMs = await redis.pttl(key);
    const effectiveTtlMs = Math.max(windowMs, blockDuration, counterTtlMs > 0 ? counterTtlMs : 0);
    await redis.set(blockedUntilKey, `${nextBlockedUntil}`, "PX", effectiveTtlMs);
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
  if (!email) {
    const ipAttempt = await incrementIpAttempt(ip);
    return { allowed: ipAttempt.allowed, attemptCount: ipAttempt.attemptCount };
  }

  const now = Date.now();
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

export async function recordSuccessfulTokenUsage(tokenHash: string, ip: string): Promise<void> {
  const tokenKey = `${TOKEN_PREFIX}${tokenHash}`;
  await deleteRateLimitEntry(tokenKey);
  await deleteRateLimitEntry(`${BLOCKED_UNTIL_PREFIX}${tokenKey}`);
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

export async function getRateLimitStats(): Promise<{
  loginAttemptsCount: number;
  ipAttemptsCount: number;
  tokenAttemptsCount: number;
  forgotPasswordAttemptsCount: number;
  contactAttemptsCount: number;
  geocodeAttemptsCount: number;
}> {
  const redis = getRedisClient();
  const [loginKeys, ipKeys, tokenKeys, forgotKeys, contactKeys, geocodeKeys] = await Promise.all([
    redis.keys(`${LOGIN_PREFIX}*`),
    redis.keys(`${IP_PREFIX}*`),
    redis.keys(`${TOKEN_PREFIX}*`),
    redis.keys(`${FORGOT_PASSWORD_PREFIX}*`),
    redis.keys(`${CONTACT_PREFIX}*`),
    redis.keys(`${GEOCODE_PREFIX}*`),
  ]);

  return {
    loginAttemptsCount: loginKeys.length,
    ipAttemptsCount: ipKeys.length,
    tokenAttemptsCount: tokenKeys.length,
    forgotPasswordAttemptsCount: forgotKeys.length,
    contactAttemptsCount: contactKeys.length,
    geocodeAttemptsCount: geocodeKeys.length,
  };
}

export async function resetRateLimitForTesting(): Promise<void> {
  const { resetRedisForTesting } = await import("./redis-client");
  await resetRedisForTesting();
}
