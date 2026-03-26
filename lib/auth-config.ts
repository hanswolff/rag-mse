import { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { compare } from "bcryptjs";
import { Role } from "@prisma/client";
import { logInfo, logError, logWarn, maskEmail, maskToken } from "./logger";
import { checkLoginRateLimit, recordSuccessfulLogin } from "./rate-limiter";
import { getClientIdentifierFromHeaders } from "./proxy-trust";
import { shouldFailOpenOnRateLimiterError } from "./rate-limit-policy";
import { RateLimitError, RateLimitUnavailableError } from "./errors";
import { validateLoginProof, verifyImpersonationStartProof, verifyImpersonationStopProof } from "./auth-proof";

const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
const COOKIE_MAX_AGE = Number.parseInt(process.env.COOKIE_MAX_AGE || "", 10);
const SESSION_MAX_AGE = Number.isFinite(COOKIE_MAX_AGE) && COOKIE_MAX_AGE > 0 ? COOKIE_MAX_AGE : 60 * 60 * 24 * 7;

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
    try {
      await recordSuccessfulLogin(clientIp, user.email);
    } catch (error) {
      logWarn('login_rate_limit_cleanup_failed', 'Failed to clear login rate limit state after proof login', {
        clientIp,
        email: maskEmail(user.email),
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
      throw new RateLimitUnavailableError();
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

    throw new RateLimitError(blockedMinutes);
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
      if (!user && token.id) {
        const currentUser = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: { role: true, name: true },
        });
        if (currentUser) {
          token.role = currentUser.role;
          token.name = currentUser.name || "";
        }
      }
      if (trigger === "update") {
        const updatePayload = session as Record<string, unknown> | undefined;
        const impersonationStartProof = typeof updatePayload?.impersonationStartProof === "string"
          ? updatePayload.impersonationStartProof
          : "";
        const impersonationStopProof = typeof updatePayload?.impersonationStopProof === "string"
          ? updatePayload.impersonationStopProof
          : "";

        if (impersonationStartProof) {
          const actorUserId = String(token.id || "");
          const verifiedStart = verifyImpersonationStartProof(impersonationStartProof, actorUserId);
          const alreadyImpersonating = Boolean((token as Record<string, unknown>).impersonatedById);

          if (!verifiedStart || token.role !== "SITE_ADMINISTRATOR" || alreadyImpersonating || verifiedStart.targetUserId === actorUserId) {
            logWarn("impersonation_start_denied", "Rejected impersonation start proof in JWT callback", {
              actorUserId,
              tokenRole: token.role,
              alreadyImpersonating,
              proofPreview: maskToken(impersonationStartProof),
            });
            return token;
          }

          const targetUser = await prisma.user.findUnique({
            where: { id: verifiedStart.targetUserId },
            select: { id: true, role: true, name: true, email: true },
          });

          if (!targetUser) {
            logWarn("impersonation_start_target_missing", "Impersonation target missing during JWT update", {
              actorUserId,
              targetUserId: verifiedStart.targetUserId,
            });
            return token;
          }

          const actorName = typeof token.name === "string" ? token.name : "";
          const actorEmail = typeof token.email === "string" ? token.email : "";

          (token as Record<string, unknown>).impersonatedById = actorUserId;
          (token as Record<string, unknown>).impersonatedByRole = String(token.role || "");
          (token as Record<string, unknown>).impersonatedByName = actorName;
          (token as Record<string, unknown>).impersonatedByEmail = actorEmail;

          token.id = targetUser.id;
          token.role = targetUser.role;
          token.name = targetUser.name || "";
          token.email = targetUser.email;

          logInfo("impersonation_started", "User impersonation activated", {
            actorUserId,
            targetUserId: targetUser.id,
            targetRole: targetUser.role,
          });
          return token;
        }

        if (impersonationStopProof) {
          const storedActorUserId = String((token as Record<string, unknown>).impersonatedById || "");
          const effectiveUserId = String(token.id || "");

          if (!storedActorUserId) {
            logWarn("impersonation_stop_denied", "Stop impersonation requested without active impersonation", {
              effectiveUserId,
              proofPreview: maskToken(impersonationStopProof),
            });
            return token;
          }

          const isValidStopProof = verifyImpersonationStopProof(
            impersonationStopProof,
            storedActorUserId,
            effectiveUserId
          );
          if (!isValidStopProof) {
            logWarn("impersonation_stop_denied", "Rejected impersonation stop proof in JWT callback", {
              storedActorUserId,
              effectiveUserId,
              proofPreview: maskToken(impersonationStopProof),
            });
            return token;
          }

          const actorUser = await prisma.user.findUnique({
            where: { id: storedActorUserId },
            select: { id: true, role: true, name: true, email: true },
          });

          if (!actorUser) {
            logWarn("impersonation_stop_actor_missing", "Original actor missing during impersonation stop", {
              storedActorUserId,
              effectiveUserId,
            });
            return token;
          }

          token.id = actorUser.id;
          token.role = actorUser.role;
          token.name = actorUser.name || "";
          token.email = actorUser.email;

          delete (token as Record<string, unknown>).impersonatedById;
          delete (token as Record<string, unknown>).impersonatedByRole;
          delete (token as Record<string, unknown>).impersonatedByName;
          delete (token as Record<string, unknown>).impersonatedByEmail;

          logInfo("impersonation_stopped", "User impersonation deactivated", {
            actorUserId: actorUser.id,
            previousEffectiveUserId: effectiveUserId,
          });
          return token;
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
