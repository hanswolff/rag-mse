import { prisma } from "@/lib/prisma";
import { runMaintenanceCleanup } from "@/lib/maintenance-worker";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    outgoingEmail: {
      updateMany: jest.fn(),
    },
    passwordReset: {
      deleteMany: jest.fn(),
    },
    invitation: {
      deleteMany: jest.fn(),
    },
    eventReminderDispatch: {
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  outgoingEmail: { updateMany: jest.Mock };
  passwordReset: { deleteMany: jest.Mock };
  invitation: { deleteMany: jest.Mock };
  eventReminderDispatch: { deleteMany: jest.Mock };
};

describe("runMaintenanceCleanup", () => {
  const now = new Date("2026-07-09T12:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.outgoingEmail.updateMany.mockResolvedValue({ count: 2 });
    mockedPrisma.passwordReset.deleteMany.mockResolvedValue({ count: 3 });
    mockedPrisma.invitation.deleteMany.mockResolvedValue({ count: 1 });
    mockedPrisma.eventReminderDispatch.deleteMany.mockResolvedValue({ count: 4 });
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

  it("deletes reminder dispatches only when both tokens are long expired", async () => {
    await runMaintenanceCleanup(now);

    expect(mockedPrisma.eventReminderDispatch.deleteMany).toHaveBeenCalledWith({
      where: {
        rsvpTokenExpiresAt: { lt: new Date("2026-06-09T12:00:00.000Z") },
        unsubscribeTokenExpiresAt: { lt: new Date("2026-06-09T12:00:00.000Z") },
      },
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
    });
  });
});
