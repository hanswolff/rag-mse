import { Permissions } from "@/lib/permissions";

describe("Permissions", () => {
  it("allows admin area read for ADMIN, SITE_ADMINISTRATOR and AUDITOR", () => {
    expect(Permissions.canAccessAdminArea("ADMIN")).toBe(true);
    expect(Permissions.canAccessAdminArea("SITE_ADMINISTRATOR")).toBe(true);
    expect(Permissions.canAccessAdminArea("AUDITOR")).toBe(true);
    expect(Permissions.canAccessAdminArea("MEMBER")).toBe(false);
  });

  it("allows admin area write only for ADMIN and SITE_ADMINISTRATOR", () => {
    expect(Permissions.canManageAdminArea("ADMIN")).toBe(true);
    expect(Permissions.canManageAdminArea("SITE_ADMINISTRATOR")).toBe(true);
    expect(Permissions.canManageAdminArea("AUDITOR")).toBe(false);
    expect(Permissions.canManageAdminArea("MEMBER")).toBe(false);
  });

  it("treats AUDITOR as member-area role", () => {
    expect(Permissions.canAccessMemberArea("AUDITOR")).toBe(true);
    expect(Permissions.canAccessMemberArea("MEMBER")).toBe(true);
  });

  it("allows AUDITOR to manage own profile and notifications", () => {
    expect(Permissions.canManageOwnProfile("AUDITOR")).toBe(true);
    expect(Permissions.canManageOwnNotifications("AUDITOR")).toBe(true);
  });

  it("rejects assigning SITE_ADMINISTRATOR role", () => {
    expect(Permissions.canAssignRole("SITE_ADMINISTRATOR")).toBe(false);
    expect(Permissions.canAssignRole("ADMIN")).toBe(true);
    expect(Permissions.canAssignRole("AUDITOR")).toBe(true);
    expect(Permissions.canAssignRole("MEMBER")).toBe(true);
  });

  it("denies auditor access to admin notifications and outgoing email logs", () => {
    expect(Permissions.canReadNotificationsAdmin("AUDITOR")).toBe(false);
    expect(Permissions.canReadOutgoingEmails("AUDITOR")).toBe(false);
    expect(Permissions.canReadNotificationsAdmin("ADMIN")).toBe(true);
    expect(Permissions.canReadOutgoingEmails("SITE_ADMINISTRATOR")).toBe(true);
  });
});

describe("Permissions - Document Permission Matrix", () => {
  const roles = ["SITE_ADMINISTRATOR", "ADMIN", "AUDITOR", "MEMBER"] as const;

  it("enforces correct read permissions for admin documents", () => {
    const expected: Record<string, boolean> = {
      SITE_ADMINISTRATOR: true,
      ADMIN: true,
      AUDITOR: true,
      MEMBER: false,
    };
    roles.forEach((role) => {
      expect(Permissions.canReadDocuments(role)).toBe(expected[role]);
    });
  });

  it("enforces correct write permissions for admin documents", () => {
    const expected: Record<string, boolean> = {
      SITE_ADMINISTRATOR: true,
      ADMIN: true,
      AUDITOR: false,
      MEMBER: false,
    };
    roles.forEach((role) => {
      expect(Permissions.canManageDocuments(role)).toBe(expected[role]);
    });
  });

  it("enforces correct read permissions for member documents", () => {
    const expected: Record<string, boolean> = {
      SITE_ADMINISTRATOR: true,
      ADMIN: true,
      AUDITOR: true,
      MEMBER: true,
    };
    roles.forEach((role) => {
      expect(Permissions.canReadMemberDocuments(role)).toBe(expected[role]);
    });
  });

  it("enforces correct write permissions for member documents", () => {
    const expected: Record<string, boolean> = {
      SITE_ADMINISTRATOR: true,
      ADMIN: true,
      AUDITOR: false,
      MEMBER: false,
    };
    roles.forEach((role) => {
      expect(Permissions.canManageMemberDocuments(role)).toBe(expected[role]);
    });
  });
});
