/**
 * Role checking utilities
 * Pure functions for checking user roles - safe for client components
 */

import { Permissions } from "./permissions";

export type UserRole = "SITE_ADMINISTRATOR" | "ADMIN" | "AUDITOR" | "MEMBER" | undefined;

export type UserWithRole = {
  role?: UserRole | string;
};

/**
 * Check if user has admin role
 * Safe for client components
 */
export function isAdmin(user?: UserWithRole | null): boolean {
  return Permissions.canManageAdminArea(user);
}

/**
 * Check if user can access admin area (read-only or write)
 * Safe for client components
 */
export function canAccessAdminArea(user?: UserWithRole | null): boolean {
  return Permissions.canAccessAdminArea(user);
}

/**
 * Check if user can access member area
 * Safe for client components
 */
export function isMember(user?: UserWithRole | null): boolean {
  return Permissions.canAccessMemberArea(user);
}

/**
 * Check if user has a specific role
 * Safe for client components
 */
export function hasRole(user: UserWithRole | null | undefined, role: UserRole): boolean {
  return user?.role === role;
}

/**
 * Check if a role string matches the expected role
 * Safe for client components and middleware
 */
export function isRole(userRole: UserRole, expectedRole: UserRole): boolean {
  return userRole === expectedRole;
}

/**
 * Check if role string is admin
 * Safe for client components and middleware
 */
export function hasAdminRole(role?: string): boolean {
  return Permissions.canManageAdminArea(role);
}

/**
 * Check if role string can access admin area (read-only or write)
 * Safe for client components and middleware
 */
export function hasAdminAccessRole(role?: string): boolean {
  return Permissions.canAccessAdminArea(role);
}

/**
 * Check if role string is member (MEMBER or ADMIN)
 * Safe for client components and middleware
 */
export function hasMemberRole(role?: string): boolean {
  return Permissions.canAccessMemberArea(role);
}
