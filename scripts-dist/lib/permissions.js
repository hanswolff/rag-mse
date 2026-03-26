"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permissions = exports.ASSIGNABLE_ROLES = exports.ALL_ROLES = void 0;
exports.ALL_ROLES = ["SITE_ADMINISTRATOR", "ADMIN", "AUDITOR", "MEMBER"];
exports.ASSIGNABLE_ROLES = ["ADMIN", "AUDITOR", "MEMBER"];
class Permissions {
    static getRole(userOrRole) {
        if (!userOrRole)
            return undefined;
        if (typeof userOrRole === "string")
            return userOrRole;
        return userOrRole.role;
    }
    static isKnownRole(role) {
        return !!role && exports.ALL_ROLES.includes(role);
    }
    static isAssignableRole(role) {
        return !!role && exports.ASSIGNABLE_ROLES.includes(role);
    }
    static isSiteAdministrator(userOrRole) {
        return this.getRole(userOrRole) === "SITE_ADMINISTRATOR";
    }
    static isAdministrator(userOrRole) {
        return this.getRole(userOrRole) === "ADMIN";
    }
    static isAuditor(userOrRole) {
        return this.getRole(userOrRole) === "AUDITOR";
    }
    static isMember(userOrRole) {
        return this.getRole(userOrRole) === "MEMBER";
    }
    static canAccessMemberArea(userOrRole) {
        const role = this.getRole(userOrRole);
        return role === "MEMBER" || role === "ADMIN" || role === "SITE_ADMINISTRATOR" || role === "AUDITOR";
    }
    static canAccessAdminArea(userOrRole) {
        const role = this.getRole(userOrRole);
        return role === "ADMIN" || role === "SITE_ADMINISTRATOR" || role === "AUDITOR";
    }
    static canManageAdminArea(userOrRole) {
        const role = this.getRole(userOrRole);
        return role === "ADMIN" || role === "SITE_ADMINISTRATOR";
    }
    static canReadUsers(userOrRole) {
        return this.canAccessAdminArea(userOrRole);
    }
    static canManageUsers(userOrRole) {
        return this.canManageAdminArea(userOrRole);
    }
    static canAssignRole(role) {
        return this.isAssignableRole(role);
    }
    static canReadEventsAdmin(userOrRole) {
        return this.canAccessAdminArea(userOrRole);
    }
    static canManageEvents(userOrRole) {
        return this.canManageAdminArea(userOrRole);
    }
    static canReadNewsAdmin(userOrRole) {
        return this.canAccessAdminArea(userOrRole);
    }
    static canManageNews(userOrRole) {
        return this.canManageAdminArea(userOrRole);
    }
    static canReadDocuments(userOrRole) {
        return this.canAccessAdminArea(userOrRole);
    }
    static canManageDocuments(userOrRole) {
        return this.canManageAdminArea(userOrRole);
    }
    static canReadMemberDocuments(userOrRole) {
        return this.canAccessMemberArea(userOrRole);
    }
    static canManageMemberDocuments(userOrRole) {
        return this.canManageAdminArea(userOrRole);
    }
    static canReadNotificationsAdmin(userOrRole) {
        return this.canManageAdminArea(userOrRole);
    }
    static canReadOutgoingEmails(userOrRole) {
        return this.canManageAdminArea(userOrRole);
    }
    static canManageOutgoingEmails(userOrRole) {
        return this.canManageAdminArea(userOrRole);
    }
    static canManageInvitations(userOrRole) {
        return this.canManageAdminArea(userOrRole);
    }
    static canUseGeocoding(userOrRole) {
        return this.canManageEvents(userOrRole);
    }
    static canReadPollsAdmin(userOrRole) {
        return this.canAccessAdminArea(userOrRole);
    }
    static canManagePolls(userOrRole) {
        return this.canManageAdminArea(userOrRole);
    }
    static canVotePolls(userOrRole) {
        return this.canAccessMemberArea(userOrRole);
    }
    static canVoteAttendance(userOrRole) {
        return this.canAccessMemberArea(userOrRole);
    }
    static canManageOwnProfile(userOrRole) {
        return this.canAccessMemberArea(userOrRole);
    }
    static canManageOwnNotifications(userOrRole) {
        return this.canManageOwnProfile(userOrRole);
    }
    static getRoleLabel(role) {
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
exports.Permissions = Permissions;
