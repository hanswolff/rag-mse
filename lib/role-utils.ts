/**
 * Rollen-Helfer für Client-Komponenten: reine Weiterleitungen auf die
 * Permissions-API (lib/permissions.ts) unter deren Namen. Neue Nutzungen
 * sollten direkt die `can…`-Funktionen verwenden.
 */

import { Permissions } from "./permissions";

export type UserRole = "SITE_ADMINISTRATOR" | "ADMIN" | "AUDITOR" | "MEMBER" | undefined;

export type UserWithRole = {
  role?: UserRole | string;
};

export function canManageAdminArea(user?: UserWithRole | null): boolean {
  return Permissions.canManageAdminArea(user);
}

export function canAccessAdminArea(user?: UserWithRole | null): boolean {
  return Permissions.canAccessAdminArea(user);
}

export function canAccessMemberArea(user?: UserWithRole | null): boolean {
  return Permissions.canAccessMemberArea(user);
}

export function canManageOwnProfile(user?: UserWithRole | null): boolean {
  return Permissions.canManageOwnProfile(user);
}

export function canManageOwnNotifications(user?: UserWithRole | null): boolean {
  return Permissions.canManageOwnNotifications(user);
}

export function canReadMemberDocuments(user?: UserWithRole | null): boolean {
  return Permissions.canReadMemberDocuments(user);
}

export function canManageMemberDocuments(user?: UserWithRole | null): boolean {
  return Permissions.canManageMemberDocuments(user);
}

export function canManagePolls(user?: UserWithRole | null): boolean {
  return Permissions.canManagePolls(user);
}

export function canVotePolls(user?: UserWithRole | null): boolean {
  return Permissions.canVotePolls(user);
}

/** @deprecated `Permissions.canManageAdminArea` verwenden. */
export function hasAdminRole(role?: string): boolean {
  return Permissions.canManageAdminArea(role);
}

/** @deprecated `Permissions.canAccessAdminArea` verwenden. */
export function hasAdminAccessRole(role?: string): boolean {
  return Permissions.canAccessAdminArea(role);
}

/** @deprecated `Permissions.canAccessMemberArea` verwenden. */
export function hasMemberRole(role?: string): boolean {
  return Permissions.canAccessMemberArea(role);
}

/** @deprecated `Permissions.canManageOwnProfile` verwenden. */
export function hasSelfServiceRole(role?: string): boolean {
  return Permissions.canManageOwnProfile(role);
}

const ROLE_SORT_ORDER: Record<string, number> = {
  SITE_ADMINISTRATOR: 0,
  ADMIN: 1,
  AUDITOR: 2,
  MEMBER: 3,
};

/** Sortiert nach Rollenrang (SITE_ADMINISTRATOR zuerst), innerhalb einer Rolle nach Name. */
export function sortUsersByRole<T extends { role: string; name: string | null }>(users: T[]): T[] {
  return users.sort((a, b) => {
    if (a.role === b.role) {
      return (a.name ?? "").localeCompare(b.name ?? "", "de");
    }
    return ROLE_SORT_ORDER[a.role] - ROLE_SORT_ORDER[b.role];
  });
}
