import { getRedisClient } from "./redis-client";

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lastAttemptAt: number;
  blockedUntil?: number;
}

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

async function getRateLimitEntry(key: string): Promise<RateLimitEntry | null> {
  const redis = getRedisClient();
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as RateLimitEntry;
  } catch {
    return null;
  }
}

async function setRateLimitEntry(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void> {
  const redis = getRedisClient();
  const ttlSec = Math.ceil(ttlMs / 1000);
  await redis.set(key, JSON.stringify(entry), "EX", ttlSec);
}

async function deleteRateLimitEntry(key: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(key);
}

async function decrementIpCounter(ip: string): Promise<void> {
  const ipKey = `${IP_PREFIX}${ip}`;
  const ipEntry = await getRateLimitEntry(ipKey);
  if (ipEntry) {
    ipEntry.count = Math.max(0, ipEntry.count - 1);
    const ttlSec = Math.ceil((ipEntry.resetAt - Date.now()) / 1000);
    if (ttlSec > 0) {
      await setRateLimitEntry(ipKey, ipEntry, ttlSec * 1000);
    }
  }
}

export interface LoginAttemptResult {
  allowed: boolean;
  blockedUntil?: number;
  attemptCount: number;
}

export interface TokenAttemptResult {
  allowed: boolean;
  blockedUntil?: number;
  attemptCount: number;
}

export interface ForgotPasswordAttemptResult {
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
  const now = Date.now();
  const ipKey = `${IP_PREFIX}${ip}`;
  const ipEntry = await getRateLimitEntry(ipKey);
  if (!ipEntry || ipEntry.resetAt <= now) {
    const newEntry: RateLimitEntry = { count: 1, resetAt: now + IP_WINDOW_MS, lastAttemptAt: now };
    await setRateLimitEntry(ipKey, newEntry, IP_WINDOW_MS);
    return { allowed: true, attemptCount: 1 };
  }
  if (ipEntry.count >= IP_MAX_ATTEMPTS) {
    return { allowed: false, attemptCount: ipEntry.count };
  }
  ipEntry.count += 1;
  ipEntry.lastAttemptAt = now;
  await setRateLimitEntry(ipKey, ipEntry, ipEntry.resetAt - now);
  return { allowed: true, attemptCount: ipEntry.count };
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
  const entry = await getRateLimitEntry(key);
  if (!entry || entry.resetAt <= now) {
    const newEntry: RateLimitEntry = { count: 1, resetAt: now + windowMs, lastAttemptAt: now };
    await setRateLimitEntry(key, newEntry, windowMs);
    return { allowed: true, attemptCount: 1 };
  }

  if (entry.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, blockedUntil: entry.blockedUntil, attemptCount: entry.count };
  }

  entry.count += 1;
  entry.lastAttemptAt = now;

  const blockDuration = checkThresholds(entry.count, thresholds);
  if (blockDuration > 0) {
    entry.blockedUntil = now + blockDuration;
    await setRateLimitEntry(key, entry, entry.resetAt - now);
    return { allowed: false, blockedUntil: entry.blockedUntil, attemptCount: entry.count };
  }

  await setRateLimitEntry(key, entry, entry.resetAt - now);
  return { allowed: true, attemptCount: entry.count };
}

async function checkFixedWindowRateLimit(
  keyPrefix: string,
  keySuffix: string,
  windowMs: number,
  maxAttempts: number
): Promise<FixedWindowAttemptResult> {
  const redis = getRedisClient();
  const key = `${keyPrefix}${keySuffix}`;
  const currentCount = await redis.incr(key);

  if (currentCount === 1) {
    await redis.pexpire(key, windowMs);
  }

  return {
    allowed: currentCount <= maxAttempts,
    attemptCount: currentCount,
  };
}

export async function checkLoginRateLimit(ip: string, email?: string): Promise<LoginAttemptResult> {
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
  await decrementIpCounter(ip);
}

export async function checkTokenRateLimit(ip: string, tokenHash: string): Promise<TokenAttemptResult> {
  const now = Date.now();
  return checkRateLimit(TOKEN_PREFIX, tokenHash, now, TOKEN_WINDOW_MS, TOKEN_ATTEMPT_THRESHOLDS, ip);
}

export async function recordSuccessfulTokenUsage(tokenHash: string, ip: string): Promise<void> {
  const tokenKey = `${TOKEN_PREFIX}${tokenHash}`;
  await deleteRateLimitEntry(tokenKey);
  await decrementIpCounter(ip);
}

export async function checkForgotPasswordRateLimit(ip: string, email: string): Promise<ForgotPasswordAttemptResult> {
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
