import { Role } from "@prisma/client";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    user: { count: jest.fn() },
    shootingRange: { count: jest.fn() },
    outgoingEmail: { count: jest.fn() },
    document: { findMany: jest.fn() },
  },
}));

jest.mock("@/lib/document-storage", () => ({
  getDocumentsDirectory: jest.fn(() => "/srv/data/documents"),
  getDocumentFilePath: jest.fn((name: string) => `/srv/data/documents/${name}`),
}));

jest.mock("node:fs", () => ({
  constants: { R_OK: 4, W_OK: 2 },
  promises: { access: jest.fn(), stat: jest.fn() },
  existsSync: jest.fn(() => false),
  readdirSync: jest.fn(() => []),
}));

jest.mock("node:fs/promises", () => ({
  statfs: jest.fn(),
}));

jest.mock("@/lib/email/dev-mode", () => ({ isDevModeEnabled: jest.fn(() => false) }));
jest.mock("@/lib/email/config", () => ({
  getSmtpConfig: jest.fn(() => ({ host: "mail", port: 587, secure: false, user: "u", password: "p", from: "f" })),
  getSmtpTimeouts: jest.fn(() => ({ SMTP_TIMEOUT_MS: 30000, SMTP_CONNECTION_TIMEOUT_MS: 10000 })),
}));
jest.mock("@/lib/email/outbox-worker", () => ({
  createSmtpTransport: jest.fn(),
  isEmailOutboxWorkerRunning: jest.fn(() => true),
}));
jest.mock("@/lib/event-reminder-worker", () => ({ isEventReminderWorkerRunning: jest.fn(() => true) }));
jest.mock("@/lib/config-validation", () => ({ validateProductionConfig: jest.fn() }));

import { promises as fs } from "node:fs";
import { statfs } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { isDevModeEnabled } from "@/lib/email/dev-mode";
import { getSmtpConfig } from "@/lib/email/config";
import { createSmtpTransport, isEmailOutboxWorkerRunning } from "@/lib/email/outbox-worker";
import { isEventReminderWorkerRunning } from "@/lib/event-reminder-worker";
import { validateProductionConfig } from "@/lib/config-validation";
import { dataPresenceChecks } from "@/lib/selftest/checks/data-presence";
import { documentStorageChecks } from "@/lib/selftest/checks/document-storage";
import { emailChecks } from "@/lib/selftest/checks/email";
import { systemChecks } from "@/lib/selftest/checks/system";
import type { RegisteredCheck } from "@/lib/selftest/types";

function run(checks: RegisteredCheck[], name: string) {
  const check = checks.find((c) => c.name === name);
  if (!check) throw new Error(`check not found: ${name}`);
  return check.run();
}

const userCount = prisma.user.count as jest.Mock;
const rangeCount = prisma.shootingRange.count as jest.Mock;
const emailCount = prisma.outgoingEmail.count as jest.Mock;
const docFindMany = prisma.document.findMany as jest.Mock;
const fsAccess = fs.access as jest.Mock;
const fsStat = fs.stat as jest.Mock;
const mockStatfs = statfs as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Re-establish default implementations; clearAllMocks() keeps overrides from leaking
  // between tests, so reset the ones individual tests toggle.
  (getSmtpConfig as jest.Mock).mockImplementation(() => ({
    host: "mail",
    port: 587,
    secure: false,
    user: "u",
    password: "p",
    from: "f",
  }));
  (isDevModeEnabled as jest.Mock).mockReturnValue(false);
  (isEmailOutboxWorkerRunning as jest.Mock).mockReturnValue(true);
  (isEventReminderWorkerRunning as jest.Mock).mockReturnValue(true);
});

describe("data presence check", () => {
  function mockCounts({ admins, users, ranges }: { admins: number; users: number; ranges: number }) {
    userCount.mockImplementation((args?: { where?: { role?: Role } }) =>
      Promise.resolve(args?.where?.role === Role.SITE_ADMINISTRATOR ? admins : users)
    );
    rangeCount.mockResolvedValue(ranges);
  }

  it("errors when no SITE_ADMINISTRATOR exists", async () => {
    mockCounts({ admins: 0, users: 5, ranges: 2 });
    const result = await run(dataPresenceChecks, "data.critical");
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/SITE_ADMINISTRATOR/);
  });

  it("warns on a fresh install with no ranges or members", async () => {
    mockCounts({ admins: 1, users: 1, ranges: 0 });
    const result = await run(dataPresenceChecks, "data.critical");
    expect(result.status).toBe("warn");
  });

  it("passes when admins, members and ranges are present", async () => {
    mockCounts({ admins: 1, users: 10, ranges: 3 });
    const result = await run(dataPresenceChecks, "data.critical");
    expect(result.status).toBe("ok");
  });

  it("warns when emails are failed or stuck", async () => {
    emailCount.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    const result = await run(dataPresenceChecks, "data.email_queue");
    expect(result.status).toBe("warn");
    expect(result.details).toMatchObject({ failed: 2, stuck: 1 });
  });
});

describe("document storage check", () => {
  it("errors when the directory is not writable", async () => {
    fsAccess.mockRejectedValue(new Error("EACCES"));
    const result = await run(documentStorageChecks, "storage.documents");
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/nicht lesbar/);
  });

  it("errors when a sampled document file is missing on disk", async () => {
    fsAccess.mockResolvedValue(undefined);
    docFindMany.mockResolvedValue([{ id: "1", storedFileName: "a.pdf" }]);
    fsStat.mockRejectedValue(new Error("ENOENT"));
    const result = await run(documentStorageChecks, "storage.documents");
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/fehlen/);
  });

  it("passes when the directory is writable and sampled files exist", async () => {
    fsAccess.mockResolvedValue(undefined);
    docFindMany.mockResolvedValue([{ id: "1", storedFileName: "a.pdf" }]);
    fsStat.mockResolvedValue({});
    const result = await run(documentStorageChecks, "storage.documents");
    expect(result.status).toBe("ok");
  });
});

describe("email check", () => {
  it("skips the live verify in dev mode without touching SMTP config", async () => {
    (isDevModeEnabled as jest.Mock).mockReturnValue(true);
    // Dev mode may run with no SMTP config at all; getSmtpConfig must not be reached.
    (getSmtpConfig as jest.Mock).mockImplementation(() => {
      throw new Error("E-Mail-Konfiguration unvollständig");
    });
    const result = await run(emailChecks, "email.smtp");
    expect(result.status).toBe("skipped");
    expect(getSmtpConfig).not.toHaveBeenCalled();
  });

  it("passes when transporter.verify succeeds", async () => {
    (isDevModeEnabled as jest.Mock).mockReturnValue(false);
    const close = jest.fn();
    (createSmtpTransport as jest.Mock).mockReturnValue({ verify: jest.fn().mockResolvedValue(true), close });
    const result = await run(emailChecks, "email.smtp");
    expect(result.status).toBe("ok");
    expect(close).toHaveBeenCalled();
  });
});

describe("system checks", () => {
  it("maps config-validation errors to an error verdict", async () => {
    (validateProductionConfig as jest.Mock).mockReturnValue({
      isValid: false,
      errors: ["COOKIE_SECURE muss true sein"],
      warnings: [],
    });
    const result = await run(systemChecks, "system.config");
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/COOKIE_SECURE/);
  });

  it("errors when disk space is critically low", async () => {
    mockStatfs.mockResolvedValue({ bavail: 100, bsize: 1024, blocks: 1_000_000 });
    const result = await run(systemChecks, "system.disk");
    expect(result.status).toBe("error");
  });

  it("warns when disk space is low but not critical", async () => {
    // ~100 MB free, ~2.5% of the volume: above the error thresholds, below the warn ones.
    mockStatfs.mockResolvedValue({ bavail: 25_600, bsize: 4096, blocks: 1_000_000 });
    const result = await run(systemChecks, "system.disk");
    expect(result.status).toBe("warn");
  });

  it("reports ample disk space as ok", async () => {
    mockStatfs.mockResolvedValue({ bavail: 1_000_000, bsize: 4096, blocks: 2_000_000 });
    const result = await run(systemChecks, "system.disk");
    expect(result.status).toBe("ok");
  });

  it("skips the worker check under the test runner", async () => {
    const result = await run(systemChecks, "system.workers");
    expect(result.status).toBe("skipped");
  });

  it("errors outside the test runner when a worker is not running", async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    (isEmailOutboxWorkerRunning as jest.Mock).mockReturnValue(false);
    (isEventReminderWorkerRunning as jest.Mock).mockReturnValue(true);
    try {
      const result = await run(systemChecks, "system.workers");
      expect(result.status).toBe("error");
      expect(result.message).toMatch(/E-Mail-Versand/);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });
});
