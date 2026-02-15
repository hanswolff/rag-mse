import { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { compare } from "bcryptjs";
import { Role } from "@prisma/client";
import { logInfo, logError, logWarn, maskEmail } from "./logger";
import { checkLoginRateLimit, recordSuccessfulLogin } from "./rate-limiter";
import { getClientIdentifierFromHeaders } from "./proxy-trust";

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

async function authorizeUser(credentials?: { email?: string; password?: string }, req?: unknown): Promise<AuthUser | null> {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const trimmedEmail = credentials.email.trim();
  const normalizedEmail = trimmedEmail.toLowerCase();
  const clientIp = getClientIpFromAuthRequest(req);
  let rateLimitResult = { allowed: true, attemptCount: 0 } as {
    allowed: boolean;
    blockedUntil?: number;
    attemptCount: number;
  };
  try {
    rateLimitResult = await checkLoginRateLimit(clientIp, normalizedEmail);
  } catch (error) {
    logWarn('login_rate_limit_unavailable', 'Rate limiter unavailable during login, continuing without enforcement', {
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
  credentials?: { email?: string; password?: string },
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
