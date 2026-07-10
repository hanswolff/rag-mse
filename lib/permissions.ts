export const ALL_ROLES = ["SITE_ADMINISTRATOR", "ADMIN", "AUDITOR", "MEMBER"] as const;
export const ASSIGNABLE_ROLES = ["ADMIN", "AUDITOR", "MEMBER"] as const;

export type AppRole = (typeof ALL_ROLES)[number];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type UserWithRole = {
  role?: string;
} | null | undefined;

export class Permissions {
  static getRole(userOrRole: UserWithRole | string | undefined): string | undefined {
    if (!userOrRole) return undefined;
    if (typeof userOrRole === "string") return userOrRole;
    return userOrRole.role;
  }

  static isKnownRole(role?: string): role is AppRole {
    return !!role && (ALL_ROLES as readonly string[]).includes(role);
  }

  static isAssignableRole(role?: string): role is AssignableRole {
    return !!role && (ASSIGNABLE_ROLES as readonly string[]).includes(role);
  }

  static isSiteAdministrator(userOrRole: UserWithRole | string | undefined): boolean {
    return this.getRole(userOrRole) === "SITE_ADMINISTRATOR";
  }

  static isAdministrator(userOrRole: UserWithRole | string | undefined): boolean {
    return this.getRole(userOrRole) === "ADMIN";
  }

  static isAuditor(userOrRole: UserWithRole | string | undefined): boolean {
    return this.getRole(userOrRole) === "AUDITOR";
  }

  static isMember(userOrRole: UserWithRole | string | undefined): boolean {
    return this.getRole(userOrRole) === "MEMBER";
  }

  static canAccessMemberArea(userOrRole: UserWithRole | string | undefined): boolean {
    const role = this.getRole(userOrRole);
    return role === "MEMBER" || role === "ADMIN" || role === "SITE_ADMINISTRATOR" || role === "AUDITOR";
  }

  static canAccessAdminArea(userOrRole: UserWithRole | string | undefined): boolean {
    const role = this.getRole(userOrRole);
    return role === "ADMIN" || role === "SITE_ADMINISTRATOR" || role === "AUDITOR";
  }

  static canManageAdminArea(userOrRole: UserWithRole | string | undefined): boolean {
    const role = this.getRole(userOrRole);
    return role === "ADMIN" || role === "SITE_ADMINISTRATOR";
  }

  static canReadUsers(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canAccessAdminArea(userOrRole);
  }

  static canManageUsers(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageAdminArea(userOrRole);
  }

  static canAssignRole(role: string | undefined): boolean {
    return this.isAssignableRole(role);
  }

  static canReadEventsAdmin(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canAccessAdminArea(userOrRole);
  }

  static canManageEvents(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageAdminArea(userOrRole);
  }

  static canReadNewsAdmin(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canAccessAdminArea(userOrRole);
  }

  static canManageNews(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageAdminArea(userOrRole);
  }

  static canReadDocuments(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canAccessAdminArea(userOrRole);
  }

  static canManageDocuments(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageAdminArea(userOrRole);
  }

  static canReadMemberDocuments(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canAccessMemberArea(userOrRole);
  }

  static canManageMemberDocuments(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageAdminArea(userOrRole);
  }

  static canReadAusschreibungenAdmin(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canAccessAdminArea(userOrRole);
  }

  static canManageAusschreibungen(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageAdminArea(userOrRole);
  }

  static canReadNotificationsAdmin(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageAdminArea(userOrRole);
  }

  static canReadOutgoingEmails(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageAdminArea(userOrRole);
  }

  static canManageOutgoingEmails(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageAdminArea(userOrRole);
  }

  static canManageInvitations(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageAdminArea(userOrRole);
  }

  static canUseGeocoding(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageEvents(userOrRole);
  }

  static canReadPollsAdmin(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canAccessAdminArea(userOrRole);
  }

  static canManagePolls(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageAdminArea(userOrRole);
  }

  static canVotePolls(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canAccessMemberArea(userOrRole);
  }

  static canVoteAttendance(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canAccessMemberArea(userOrRole);
  }

  static canManageOwnProfile(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canAccessMemberArea(userOrRole);
  }

  static canManageOwnNotifications(userOrRole: UserWithRole | string | undefined): boolean {
    return this.canManageOwnProfile(userOrRole);
  }

  static getRoleLabel(role?: string): string {
    switch (role) {
      case "SITE_ADMINISTRATOR":
        return "Site-Administrator";
      case "ADMIN":
        return "Administrator";
      case "AUDITOR":
        return "Prüfer";
      case "MEMBER":
        return "Mitglied";
      default:
        return "Unbekannt";
    }
  }
}
