import {
  generateInvitationToken,
  hashInvitationToken,
  getInvitationExpiryDate,
  buildInviteUrl,
  sendInvitationEmail,
  INVITATION_VALIDITY_DAYS,
} from "../lib/invitations";
import { sendTemplateEmail } from "../lib/email-sender";

jest.mock("../lib/email-sender");

describe("lib/invitations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_NAME = "Test App";
  });

  afterEach(() => {
    delete process.env.APP_NAME;
  });

  describe("generateInvitationToken", () => {
    it("should generate a unique token", () => {
      const token1 = generateInvitationToken();
      const token2 = generateInvitationToken();

      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
    });

    it("should generate a hex string", () => {
      const token = generateInvitationToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it("should generate a 64-character hex string", () => {
      const token = generateInvitationToken();
      expect(token.length).toBe(64);
    });
  });

  describe("hashInvitationToken", () => {
    it("should hash a token consistently", () => {
      const token = generateInvitationToken();
      const hash1 = hashInvitationToken(token);
      const hash2 = hashInvitationToken(token);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different tokens", () => {
      const token1 = generateInvitationToken();
      const token2 = generateInvitationToken();
      const hash1 = hashInvitationToken(token1);
      const hash2 = hashInvitationToken(token2);

      expect(hash1).not.toBe(hash2);
    });

    it("should produce a SHA-256 hex hash", () => {
      const token = generateInvitationToken();
      const hash = hashInvitationToken(token);

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("getInvitationExpiryDate", () => {
    it("should return a date 14 days in the future", () => {
      const now = new Date("2024-01-01T00:00:00Z");
      const expiry = getInvitationExpiryDate(now);
      const expected = new Date("2024-01-15T00:00:00Z");

      expect(expiry.getTime()).toBe(expected.getTime());
    });

    it("should use current date when no date provided", () => {
      const now = new Date();
      const expiry = getInvitationExpiryDate();
      const expected = new Date(now);
      expected.setDate(expected.getDate() + INVITATION_VALIDITY_DAYS);

      expect(expiry.getTime()).toBeCloseTo(expected.getTime(), -3);
    });
  });

  describe("buildInviteUrl", () => {
    it("should build invite URL with token", () => {
      const appUrl = "https://example.com";
      const token = "abc123";
      const url = buildInviteUrl(appUrl, token);

      expect(url).toBe("https://example.com/einladung/abc123");
    });

    it("should remove trailing slash from appUrl", () => {
      const appUrl = "https://example.com/";
      const token = "abc123";
      const url = buildInviteUrl(appUrl, token);

      expect(url).toBe("https://example.com/einladung/abc123");
    });

    it("should preserve path in appUrl", () => {
      const appUrl = "https://example.com/subdir";
      const token = "abc123";
      const url = buildInviteUrl(appUrl, token);

      expect(url).toBe("https://example.com/subdir/einladung/abc123");
    });
  });

  describe("sendInvitationEmail", () => {
    beforeEach(() => {
      (sendTemplateEmail as jest.Mock).mockResolvedValue(undefined);
    });

    it("should send email with correct template and variables", async () => {
      const email = "test@example.com";
      const inviteUrl = "https://example.com/einladung/token123";

      const result = await sendInvitationEmail({
        email,
        inviteUrl,
      });

      expect(result.success).toBe(true);
      expect(sendTemplateEmail).toHaveBeenCalledWith({
        template: "einladung-zur-rag-mse",
        variables: {
          appName: "Test App",
          inviteUrl,
          inviteValidityDays: "14",
        },
        to: email,
      });
    });

    it("should include log context when provided", async () => {
      const email = "test@example.com";
      const inviteUrl = "https://example.com/einladung/token123";
      const logContext = {
        route: "/test/route",
        method: "POST",
        invitationId: "inv-123",
        invitedBy: "admin@example.com",
      };

      await sendInvitationEmail({
        email,
        inviteUrl,
        logContext,
      });

      expect(sendTemplateEmail).toHaveBeenCalledWith({
        template: "einladung-zur-rag-mse",
        variables: expect.any(Object),
        to: email,
      });
    });

    it("should use default app name when not set", async () => {
      delete process.env.APP_NAME;
      const email = "test@example.com";
      const inviteUrl = "https://example.com/einladung/token123";

      await sendInvitationEmail({
        email,
        inviteUrl,
      });

      expect(sendTemplateEmail).toHaveBeenCalledWith({
        template: "einladung-zur-rag-mse",
        variables: {
          appName: "RAG Schießsport MSE",
          inviteUrl,
          inviteValidityDays: "14",
        },
        to: email,
      });
    });

    it("should return success: true when email is sent successfully", async () => {
      const result = await sendInvitationEmail({
        email: "test@example.com",
        inviteUrl: "https://example.com/einladung/token123",
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return success: false and error when email sending fails", async () => {
      const error = new Error("SMTP connection failed");
      (sendTemplateEmail as jest.Mock).mockRejectedValue(error);

      const result = await sendInvitationEmail({
        email: "test@example.com",
        inviteUrl: "https://example.com/einladung/token123",
        logContext: {
          route: "/api/admin/invitations",
          method: "POST",
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("SMTP connection failed");
    });

    it("should handle non-Error objects when email sending fails", async () => {
      (sendTemplateEmail as jest.Mock).mockRejectedValue("String error");

      const result = await sendInvitationEmail({
        email: "test@example.com",
        inviteUrl: "https://example.com/einladung/token123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("String error");
    });
  });

  describe("INVITATION_VALIDITY_DAYS", () => {
    it("should be defined as 14 days", () => {
      expect(INVITATION_VALIDITY_DAYS).toBe(14);
    });
  });
});
