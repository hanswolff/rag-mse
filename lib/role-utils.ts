/**
 * Role checking utilities
 * Pure functions for checking user roles - safe for client components
 */

export type UserRole = "ADMIN" | "MEMBER" | undefined;

export type UserWithRole = {
  role?: UserRole | string;
};

/**
 * Check if user has admin role
 * Safe for client components
 */
export function isAdmin(user?: UserWithRole | null): boolean {
  return user?.role === "ADMIN";
}

/**
 * Check if user has member role (MEMBER or ADMIN)
 * Safe for client components
 */
export function isMember(user?: UserWithRole | null): boolean {
  return user?.role === "MEMBER" || user?.role === "ADMIN";
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
  return role === "ADMIN";
}

/**
 * Check if role string is member (MEMBER or ADMIN)
 * Safe for client components and middleware
 */
export function hasMemberRole(role?: string): boolean {
  return role === "MEMBER" || hasAdminRole(role);
}
