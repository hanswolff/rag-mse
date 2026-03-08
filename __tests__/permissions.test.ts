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

  it("does not treat AUDITOR as member-area role", () => {
    expect(Permissions.canAccessMemberArea("AUDITOR")).toBe(false);
    expect(Permissions.canAccessMemberArea("MEMBER")).toBe(true);
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
