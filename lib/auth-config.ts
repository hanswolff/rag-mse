import { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { compare } from "bcryptjs";
import { Role } from "@prisma/client";
import { logInfo, logError, logWarn, maskEmail } from "./logger";
import { checkLoginRateLimit, recordSuccessfulLogin } from "./rate-limiter";
import { getClientIdentifierFromHeaders } from "./proxy-trust";
import { shouldFailOpenOnRateLimiterError } from "./rate-limit-policy";
import { RateLimitError, RateLimitUnavailableError } from "./errors";
import { validateLoginProof, verifyPasswordChangeProof } from "./auth-proof";
import { envBool, envInt } from "./env";
import {
  applyImpersonationStart,
  applyImpersonationStop,
  invalidateToken,
  readImpersonationProofs,
  restoreActorIdentity,
} from "./impersonation-session";
import type { JWT } from "next-auth/jwt";

const COOKIE_SECURE = envBool("COOKIE_SECURE");
const SESSION_MAX_AGE = envInt("COOKIE_MAX_AGE", 60 * 60 * 24 * 7);

interface AuthUser extends User {
  role: Role;
}

type RequestLikeHeaders =
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined;

async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

const TIMING_EQUALIZER_HASH = "$2b$10$o75PoT5by2Qc34I1wZPRbuRz38i1OSSfDg7KHJFL4GTptNvlqTsxq";

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

// Site-Administratoren aktivieren sich beim ersten Login selbst; alle anderen
// Konten werden erst mit der Einladungseinlösung nutzbar.
function isActivationPending(user: { role: Role; activatedAt: Date | null }): boolean {
  return user.role !== "SITE_ADMINISTRATOR" && !user.activatedAt;
}

export function toPasswordStamp(passwordUpdatedAt: Date | null | undefined): number | null {
  return passwordUpdatedAt ? passwordUpdatedAt.getTime() : null;
}

function mapUserToAuthUser(user: LoginUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name || "",
    role: user.role,
    passwordUpdatedAt: toPasswordStamp(user.passwordUpdatedAt),
  };
}

async function findUserWithFallback(normalizedEmail: string, trimmedEmail: string) {
  const user = await findUserByEmail(normalizedEmail);
  if (user || normalizedEmail === trimmedEmail) {
    return user;
  }
  return findUserByEmail(trimmedEmail);
}

interface LoginUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  activatedAt: Date | null;
  passwordUpdatedAt?: Date | null;
}

interface FinalizeLoginOptions {
  successMessage: string;
  rateLimitCleanupWarnMessage: string;
  // Historisch abweichende Reihenfolge der beiden Login-Pfade, bewusst beibehalten:
  // Der Passwort-Pfad räumt das Rate-Limit vor dem lastLoginAt-Update auf, der Proof-Pfad danach.
  rateLimitCleanupFirst: boolean;
}

async function finalizeSuccessfulLogin(
  user: LoginUser,
  clientIp: string,
  options: FinalizeLoginOptions
): Promise<AuthUser | null> {
  if (isActivationPending(user)) {
    logError("login_failed", "Login attempt failed: account not activated", {
      email: maskEmail(user.email),
      userId: user.id,
      clientIp,
    });
    return null;
  }

  const updateLastLogin = () =>
    prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        ...(user.role === "SITE_ADMINISTRATOR" && !user.activatedAt ? { activatedAt: new Date() } : {}),
      },
    });
  const clearLoginRateLimit = async () => {
    try {
      await recordSuccessfulLogin(clientIp, user.email);
    } catch (error) {
      logWarn("login_rate_limit_cleanup_failed", options.rateLimitCleanupWarnMessage, {
        clientIp,
        email: maskEmail(user.email),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  if (options.rateLimitCleanupFirst) {
    await clearLoginRateLimit();
    await updateLastLogin();
  } else {
    await updateLastLogin();
    await clearLoginRateLimit();
  }

  logInfo("login_success", options.successMessage, {
    email: maskEmail(user.email),
    userId: user.id,
    role: user.role,
    clientIp,
  });
  return mapUserToAuthUser(user);
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
    const user = await findUserWithFallback(normalizedEmail, trimmedEmail);
    if (!user) {
      logError("login_failed", "Login proof valid but user not found", {
        email: maskEmail(trimmedEmail),
        clientIp,
      });
      return null;
    }

    return finalizeSuccessfulLogin(user, clientIp, {
      successMessage: "User logged in successfully via login proof",
      rateLimitCleanupWarnMessage: "Failed to clear login rate limit state after proof login",
      rateLimitCleanupFirst: false,
    });
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
      throw new RateLimitUnavailableError();
    }

    logWarn('login_rate_limit_unavailable', 'Rate limiter unavailable during login, continuing due to fail-open policy', {
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

    throw new RateLimitError(blockedMinutes);
  }

  const user = await findUserWithFallback(normalizedEmail, trimmedEmail);
  if (!user) {
    await validatePassword(credentials.password, TIMING_EQUALIZER_HASH);
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

  return finalizeSuccessfulLogin(user, clientIp, {
    successMessage: "User logged in successfully",
    rateLimitCleanupWarnMessage: "Failed to clear login rate limit state after successful login",
    rateLimitCleanupFirst: true,
  });
}

export async function authorizeCredentials(
  credentials?: { email?: string; password?: string; loginProof?: string },
  req?: unknown
): Promise<AuthUser | null> {
  return authorizeUser(credentials, req);
}

function readPasswordChangeProof(sessionUpdatePayload: unknown): string {
  const proof = (sessionUpdatePayload as Record<string, unknown> | undefined)?.passwordChangeProof;
  return typeof proof === "string" ? proof : "";
}

// Gleicht das Token bei jeder Anfrage mit der Datenbank ab. Passwort-Stempel und
// Rollenprüfung gelten dem angemeldeten Konto — während einer Impersonierung also
// dem Site-Administrator, nicht dem Zielbenutzer.
async function refreshTokenFromDatabase(token: JWT, sessionUpdatePayload: unknown): Promise<JWT> {
  const currentUser = await prisma.user.findUnique({
    where: { id: String(token.id) },
    select: { role: true, name: true, passwordUpdatedAt: true },
  });
  if (!currentUser) {
    logWarn("session_user_deleted", "Session invalidated: user no longer exists", {
      userId: String(token.id),
    });
    return invalidateToken(token);
  }
  token.role = currentUser.role;
  token.name = currentUser.name || "";

  const impersonatedById = typeof token.impersonatedById === "string" ? token.impersonatedById : "";
  const actor = impersonatedById
    ? await prisma.user.findUnique({
        where: { id: impersonatedById },
        select: { id: true, role: true, name: true, email: true, passwordUpdatedAt: true },
      })
    : null;
  if (impersonatedById && !actor) {
    logWarn("session_actor_deleted", "Session invalidated: impersonating user no longer exists", {
      userId: String(token.id),
      impersonatedById,
    });
    return invalidateToken(token);
  }

  const loginUserId = actor?.id ?? String(token.id);
  const passwordStamp = toPasswordStamp((actor ?? currentUser).passwordUpdatedAt);
  // Alt-Token ohne Stempel: ohne je erfolgten Passwortwechsel gefahrlos übernehmbar.
  // iat taugt nicht als Login-Zeitpunkt — NextAuth setzt es bei jedem Session-Abruf neu.
  if (token.passwordUpdatedAt === undefined && passwordStamp === null) {
    token.passwordUpdatedAt = null;
  }
  if (token.passwordUpdatedAt !== passwordStamp) {
    const proof = readPasswordChangeProof(sessionUpdatePayload);
    if (!verifyPasswordChangeProof(proof, loginUserId, passwordStamp)) {
      logWarn("session_password_changed", "Session invalidated: password changed since login", {
        userId: loginUserId,
        legacyToken: token.passwordUpdatedAt === undefined,
      });
      return invalidateToken(token);
    }
    token.passwordUpdatedAt = passwordStamp;
  }

  if (actor && actor.role !== "SITE_ADMINISTRATOR") {
    logWarn("impersonation_revoked", "Impersonation ended: actor is no longer site administrator", {
      actorUserId: actor.id,
      effectiveUserId: String(token.id),
      actorRole: actor.role,
    });
    return restoreActorIdentity(token, actor);
  }

  return token;
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
        token.passwordUpdatedAt = user.passwordUpdatedAt ?? null;
      }
      if (!user && token.id) {
        token = await refreshTokenFromDatabase(token, trigger === "update" ? session : undefined);
        if (!token.id) {
          return token;
        }
      }
      if (trigger === "update") {
        const { impersonationStartProof, impersonationStopProof } = readImpersonationProofs(session);

        if (impersonationStartProof) {
          return applyImpersonationStart(token, impersonationStartProof);
        }

        if (impersonationStopProof) {
          return applyImpersonationStop(token, impersonationStopProof);
        }

        if (session?.user?.name) {
          token.name = String(session.user.name);
        } else if (session?.name) {
          token.name = String(session.name);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (!token?.id) {
        return null as unknown as typeof session;
      }
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        const impersonatedById = (token as Record<string, unknown>).impersonatedById;
        const impersonatedByRole = (token as Record<string, unknown>).impersonatedByRole;
        const impersonatedByName = (token as Record<string, unknown>).impersonatedByName;
        const impersonatedByEmail = (token as Record<string, unknown>).impersonatedByEmail;

        if (typeof impersonatedById === "string" && impersonatedById.length > 0) {
          session.user.isImpersonating = true;
          session.user.impersonatedBy = {
            id: impersonatedById,
            role: typeof impersonatedByRole === "string" ? impersonatedByRole : "",
            name: typeof impersonatedByName === "string" ? impersonatedByName : "",
            email: typeof impersonatedByEmail === "string" ? impersonatedByEmail : "",
          };
        } else {
          session.user.isImpersonating = false;
          session.user.impersonatedBy = undefined;
        }
      }
      return session;
    },
  },
};
