import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { hasAdminAccessRole, hasAdminRole, hasMemberRole, hasSelfServiceRole } from "./role-utils";
import { Permissions } from "./permissions";

export class UnauthorizedError extends Error {
  constructor(message = "Nicht autorisiert") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

const FORBIDDEN_ADMIN_MESSAGE = "Keine Admin-Berechtigung";

export class ForbiddenError extends Error {
  constructor(message = "Keine Berechtigung") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export async function requireAdmin(mode: "read" | "write" = "write") {
  if (mode === "read") {
    return requireAdminRead();
  }
  return requireAdminWrite();
}

async function requireAdminRead() {
  const user = await requireAuth();
  if (!hasAdminAccessRole(user.role)) {
    throw new ForbiddenError(FORBIDDEN_ADMIN_MESSAGE);
  }
  return user;
}

async function requireAdminWrite() {
  const user = await requireAuth();
  if (!hasAdminRole(user.role)) {
    throw new ForbiddenError(FORBIDDEN_ADMIN_MESSAGE);
  }
  return user;
}

export async function requireMember() {
  const user = await requireAuth();
  if (!hasMemberRole(user.role)) {
    throw new ForbiddenError("Keine Mitglieder-Berechtigung");
  }
  return user;
}

export async function requireSelfServiceAccess() {
  const user = await requireAuth();
  if (!hasSelfServiceRole(user.role)) {
    throw new ForbiddenError("Keine Berechtigung für eigene Kontoeinstellungen");
  }
  return user;
}

const ADMIN_PREFIX = "/admin";
const MEMBER_PREFIXES = [
  "/profil",
  "/passwort-aendern",
  "/mitglieder-dokumente",
  "/benachrichtigungen",
];

// Einzige Quelle dafür, welche Pfade überhaupt eine Anmeldung verlangen. Der
// Proxy leitet daraus ab, wann er den Auth-Token lesen muss.
export const LOGIN_REQUIRED_PREFIXES = [ADMIN_PREFIX, ...MEMBER_PREFIXES];

export function requiresLogin(pathname: string): boolean {
  return LOGIN_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function shouldRedirectToLogin(pathname: string, userRole: string | undefined): boolean {
  if (pathname.startsWith("/benachrichtigungen/abmelden")) {
    return false;
  }

  if (pathname.startsWith(ADMIN_PREFIX) && !Permissions.canAccessAdminArea(userRole)) {
    return true;
  }

  if (MEMBER_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && !hasMemberRole(userRole)) {
    return true;
  }

  return false;
}
