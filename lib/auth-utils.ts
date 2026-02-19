import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { hasAdminRole, hasMemberRole } from "./role-utils";

export class UnauthorizedError extends Error {
  constructor(message = "Nicht autorisiert") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

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

export async function requireAdmin() {
  const user = await requireAuth();
  if (!hasAdminRole(user.role)) {
    throw new ForbiddenError("Keine Admin-Berechtigung");
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

export function shouldRedirectToLogin(pathname: string, userRole: string | undefined): boolean {
  if (pathname.startsWith("/benachrichtigungen/abmelden")) {
    return false;
  }

  if (pathname.startsWith("/admin") && !hasAdminRole(userRole)) {
    return true;
  }

  if (
    (
      pathname.startsWith("/profil")
      || pathname.startsWith("/passwort-aendern")
      || pathname.startsWith("/benachrichtigungen")
    )
    && !hasMemberRole(userRole)
  ) {
    return true;
  }

  return false;
}
