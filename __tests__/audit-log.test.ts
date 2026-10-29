import { logAdminAction } from "@/lib/audit-log";
import { logInfo } from "@/lib/logger";

jest.mock("@/lib/logger", () =>
  jest.requireActual<typeof import("./helpers/logger-mock")>("./helpers/logger-mock").mockLogger,
);

describe("logAdminAction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("schreibt den impersonierenden Site-Administrator als echten Akteur mit", () => {
    logAdminAction(
      "user_update",
      {
        id: "ziel-1",
        email: "ziel@example.com",
        role: "ADMIN",
        impersonatedBy: { id: "site-1" },
      },
      { targetUserId: "user-9" }
    );

    expect(logInfo).toHaveBeenCalledWith("audit:user_update", "Admin action: user_update", {
      adminId: "ziel-1",
      adminEmail: "ziel@example.com",
      adminRole: "ADMIN",
      impersonatedById: "site-1",
      targetUserId: "user-9",
    });
  });

  it("lässt impersonatedById ohne Impersonierung leer", () => {
    logAdminAction("event_delete", { id: "admin-1", role: "ADMIN" });

    expect(logInfo).toHaveBeenCalledWith(
      "audit:event_delete",
      "Admin action: event_delete",
      expect.objectContaining({ adminId: "admin-1", impersonatedById: undefined })
    );
  });
});
