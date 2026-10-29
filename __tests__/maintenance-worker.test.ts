import { prisma } from "@/lib/prisma";
import { runMaintenanceCleanup } from "@/lib/maintenance-worker";

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

jest.mock("@/lib/logger", () =>
  jest.requireActual<typeof import("./helpers/logger-mock")>("./helpers/logger-mock").mockLogger,
);

const mockedPrisma = prisma as unknown as {
  outgoingEmail: { updateMany: jest.Mock };
  passwordReset: { deleteMany: jest.Mock };
  invitation: { deleteMany: jest.Mock };
  eventReminderDispatch: { deleteMany: jest.Mock };
  absence: { deleteMany: jest.Mock };
};

describe("runMaintenanceCleanup", () => {
  const now = new Date("2026-07-09T12:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.outgoingEmail.updateMany.mockResolvedValue({ count: 2 });
    mockedPrisma.passwordReset.deleteMany.mockResolvedValue({ count: 3 });
    mockedPrisma.invitation.deleteMany.mockResolvedValue({ count: 1 });
    mockedPrisma.eventReminderDispatch.deleteMany.mockResolvedValue({ count: 4 });
    mockedPrisma.absence.deleteMany.mockResolvedValue({ count: 5 });
  });

  it("clears attachment blobs only for terminal emails older than 30 days", async () => {
    await runMaintenanceCleanup(now);

    expect(mockedPrisma.outgoingEmail.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["SENT", "FAILED"] },
        attachmentsJson: { not: null, notIn: ["PRUNED"] },
        createdAt: { lt: new Date("2026-06-09T12:00:00.000Z") },
      },
      data: { attachmentsJson: "PRUNED" },
    });
  });

  it("clears retained one-time tokens of failed emails after 30 days", async () => {
    await runMaintenanceCleanup(now);

    expect(mockedPrisma.outgoingEmail.updateMany).toHaveBeenCalledWith({
      where: {
        status: "FAILED",
        sensitiveTokensJson: { not: null },
        createdAt: { lt: new Date("2026-06-09T12:00:00.000Z") },
      },
      data: { sensitiveTokensJson: null },
    });
  });

  it("deletes consumed and expired password reset tokens after 30 days", async () => {
    await runMaintenanceCleanup(now);

    expect(mockedPrisma.passwordReset.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { usedAt: { lt: new Date("2026-06-09T12:00:00.000Z") } },
          { usedAt: null, expiresAt: { lt: new Date("2026-06-09T12:00:00.000Z") } },
        ],
      },
    });
  });

  it("deletes consumed and expired invitations after 90 days", async () => {
    await runMaintenanceCleanup(now);

    expect(mockedPrisma.invitation.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { usedAt: { lt: new Date("2026-04-10T12:00:00.000Z") } },
          { usedAt: null, expiresAt: { lt: new Date("2026-04-10T12:00:00.000Z") } },
        ],
      },
    });
  });

  it("deletes reminder dispatches only when both tokens are long expired and the event is long past", async () => {
    await runMaintenanceCleanup(now);

    expect(mockedPrisma.eventReminderDispatch.deleteMany).toHaveBeenCalledWith({
      where: {
        rsvpTokenExpiresAt: { lt: new Date("2026-06-09T12:00:00.000Z") },
        unsubscribeTokenExpiresAt: { lt: new Date("2026-06-09T12:00:00.000Z") },
        event: { date: { lt: new Date("2026-06-09T12:00:00.000Z") } },
      },
    });
  });

  it("deletes absences that ended more than 30 Berlin calendar days ago", async () => {
    await runMaintenanceCleanup(new Date("2026-07-09T23:30:00.000Z"));

    expect(mockedPrisma.absence.deleteMany).toHaveBeenCalledWith({
      where: { endDate: { lt: new Date(2026, 5, 10) } },
    });
  });

  it("returns the affected row counts", async () => {
    const result = await runMaintenanceCleanup(now);

    expect(result).toEqual({
      clearedAttachments: 2,
      clearedSensitiveTokens: 2,
      deletedPasswordResets: 3,
      deletedInvitations: 1,
      deletedReminderDispatches: 4,
      deletedAbsences: 5,
    });
  });
});
