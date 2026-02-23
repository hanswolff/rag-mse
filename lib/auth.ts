import { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { compare } from "bcryptjs";
import { Role } from "@prisma/client";
import { logInfo, logError, logWarn, maskEmail } from "./logger";
import { checkLoginRateLimit, recordSuccessfulLogin } from "./rate-limiter";
import { getClientIdentifierFromHeaders } from "./proxy-trust";
import { shouldFailOpenOnRateLimiterError } from "./rate-limit-policy";
import crypto from "node:crypto";

const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
const COOKIE_MAX_AGE = Number.parseInt(process.env.COOKIE_MAX_AGE || "", 10);
const SESSION_MAX_AGE = Number.isFinite(COOKIE_MAX_AGE) && COOKIE_MAX_AGE > 0 ? COOKIE_MAX_AGE : 60 * 60 * 24 * 7;

interface AuthUser extends User {
  role: Role;
}

interface LoginProof {
  version: 1;
  email: string;
  clientIp: string;
  passwordDigest: string;
  expiresAt: number;
}

type RequestLikeHeaders =
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined;

const LOGIN_PROOF_TTL_MS = 60_000;
const LOGIN_PROOF_VERSION = "v1";

function hashLoginPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function getLoginProofSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("LOGIN_PROOF_UNAVAILABLE");
  }
  return secret;
}

function signLoginProof(payloadSegment: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadSegment).digest("base64url");
}

function verifyLoginProofSignature(payloadSegment: string, signatureSegment: string, secret: string): boolean {
  const expected = signLoginProof(payloadSegment, secret);
  if (expected.length !== signatureSegment.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureSegment));
}

export function createLoginProof(email: string, clientIp: string, password: string): string {
  const secret = getLoginProofSecret();
  const payload: LoginProof = {
    version: 1,
    email: email.toLowerCase(),
    clientIp,
    passwordDigest: hashLoginPassword(password),
    expiresAt: Date.now() + LOGIN_PROOF_TTL_MS,
  };

  const payloadSegment = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signatureSegment = signLoginProof(payloadSegment, secret);
  return `${LOGIN_PROOF_VERSION}.${payloadSegment}.${signatureSegment}`;
}

function validateLoginProof(token: string, email: string, clientIp: string, password: string): boolean {
  if (!token) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== LOGIN_PROOF_VERSION) {
    return false;
  }

  const [, payloadSegment, signatureSegment] = parts;
  let secret = "";
  try {
    secret = getLoginProofSecret();
  } catch {
    return false;
  }

  if (!verifyLoginProofSignature(payloadSegment, signatureSegment, secret)) {
    return false;
  }

  let payload: LoginProof | null = null;
  try {
    payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as LoginProof;
  } catch {
    return false;
  }

  if (!payload || payload.version !== 1) {
    return false;
  }

  return (
    payload.email === email.toLowerCase()
    && payload.clientIp === clientIp
    && payload.passwordDigest === hashLoginPassword(password)
    && payload.expiresAt > Date.now()
  );
}

async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

async function validatePassword(password: string, hashedPassword: string) {
  return compare(password, hashedPassword);
}

function getHeaderValue(headers: RequestLikeHeaders, name: string): string | null {
  if (!headers) return null;

  if (headers instanceof Headers) {
    return headers.get(name);
  }

  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

function getClientIpFromAuthRequest(req: unknown): string {
  const requestHeaders = (req as { headers?: RequestLikeHeaders })?.headers;
  const requestIp = (req as { ip?: string | null })?.ip || null;

  const headers = new Headers();
  const xForwardedFor = getHeaderValue(requestHeaders, "x-forwarded-for");
  const xRealIp = getHeaderValue(requestHeaders, "x-real-ip");
  const userAgent = getHeaderValue(requestHeaders, "user-agent");
  const acceptLanguage = getHeaderValue(requestHeaders, "accept-language");

  if (xForwardedFor) headers.set("x-forwarded-for", xForwardedFor);
  if (xRealIp) headers.set("x-real-ip", xRealIp);
  if (userAgent) headers.set("user-agent", userAgent);
  if (acceptLanguage) headers.set("accept-language", acceptLanguage);

  return getClientIdentifierFromHeaders(headers, requestIp);
}

function mapUserToAuthUser(user: { id: string; email: string; name: string | null; role: Role }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name || "",
    role: user.role,
  };
}

async function authorizeUser(credentials?: { email?: string; password?: string; loginProof?: string }, req?: unknown): Promise<AuthUser | null> {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const trimmedEmail = credentials.email.trim();
  const normalizedEmail = trimmedEmail.toLowerCase();
  const clientIp = getClientIpFromAuthRequest(req);
  const loginProof = typeof credentials.loginProof === "string" ? credentials.loginProof : "";

  if (loginProof && validateLoginProof(loginProof, normalizedEmail, clientIp, credentials.password)) {
    let user = await findUserByEmail(normalizedEmail);
    if (!user && normalizedEmail !== trimmedEmail) {
      user = await findUserByEmail(trimmedEmail);
    }

    if (!user) {
      logError("login_failed", "Login proof valid but user not found", {
        email: maskEmail(trimmedEmail),
        clientIp,
      });
      return null;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    logInfo("login_success", "User logged in successfully via login proof", {
      email: maskEmail(user.email),
      userId: user.id,
      role: user.role,
      clientIp,
    });
    return mapUserToAuthUser(user);
  }

  let rateLimitResult = { allowed: true, attemptCount: 0 } as {
    allowed: boolean;
    blockedUntil?: number;
    attemptCount: number;
  };
  try {
    rateLimitResult = await checkLoginRateLimit(clientIp, normalizedEmail);
  } catch (error) {
    if (!shouldFailOpenOnRateLimiterError()) {
      logError("login_rate_limit_unavailable", "Rate limiter unavailable during login, blocking request", {
        clientIp,
        email: maskEmail(trimmedEmail),
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("RATE_LIMIT_UNAVAILABLE");
    }

    logWarn('login_rate_limit_unavailable', 'Rate limiter unavailable during login, continuing due fail-open policy', {
      clientIp,
      email: maskEmail(trimmedEmail),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!rateLimitResult.allowed) {
    const blockedUntil = rateLimitResult.blockedUntil;
    const blockedMinutes = blockedUntil
      ? Math.max(1, Math.ceil((blockedUntil - Date.now()) / 60000))
      : 1;

    logWarn('login_rate_limited', 'Login attempt blocked by rate limit in authorize', {
      clientIp,
      email: maskEmail(trimmedEmail),
      attemptCount: rateLimitResult.attemptCount,
      blockedUntil,
    });

    throw new Error(`RATE_LIMITED:${blockedMinutes}`);
  }

  let user = await findUserByEmail(normalizedEmail);
  if (!user && normalizedEmail !== trimmedEmail) {
    user = await findUserByEmail(trimmedEmail);
  }
  if (!user) {
    logError('login_failed', 'Login attempt failed: user not found', {
      email: maskEmail(trimmedEmail),
      clientIp,
      attemptCount: rateLimitResult.attemptCount,
    });
    return null;
  }

  const isPasswordValid = await validatePassword(credentials.password, user.password);
  if (!isPasswordValid) {
    logError('login_failed', 'Login attempt failed: invalid password', {
      email: maskEmail(trimmedEmail),
      clientIp,
      attemptCount: rateLimitResult.attemptCount,
    });
    return null;
  }

  try {
    await recordSuccessfulLogin(clientIp, user.email);
  } catch (error) {
    logWarn('login_rate_limit_cleanup_failed', 'Failed to clear login rate limit state after successful login', {
      clientIp,
      email: maskEmail(user.email),
      error: error instanceof Error ? error.message : String(error),
    });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  logInfo('login_success', 'User logged in successfully', { email: maskEmail(user.email), userId: user.id, role: user.role, clientIp });
  return mapUserToAuthUser(user);
}

export async function authorizeCredentials(
  credentials?: { email?: string; password?: string; loginProof?: string },
  req?: unknown
): Promise<AuthUser | null> {
  return authorizeUser(credentials, req);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  useSecureCookies: COOKIE_SECURE,
  cookies: {
    sessionToken: {
      name: COOKIE_SECURE ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: COOKIE_SECURE,
        maxAge: SESSION_MAX_AGE,
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Passwort", type: "password" },
        loginProof: { label: "Login Proof", type: "text" },
      },
      authorize: (credentials, req) => authorizeCredentials(credentials, req),
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name || "";
      }
      if (trigger === "update") {
        if (session?.user?.name) {
          token.name = String(session.user.name);
        } else if (session?.name) {
          token.name = String(session.name);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
};
