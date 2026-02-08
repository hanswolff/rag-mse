import { POST } from "@/app/api/contact/route";
import { NextRequest } from "next/server";
import { sendTemplateEmail } from "@/lib/email-sender";
import { logError } from "@/lib/logger";
import * as rateLimiter from "@/lib/rate-limiter";

jest.mock("@/lib/email-sender", () => ({
  sendTemplateEmail: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
  logValidationFailure: jest.fn(),
}));

jest.mock("@/lib/api-utils", () => {
  const actualModule = jest.requireActual("@/lib/api-utils");
  return {
    ...actualModule,
    validateCsrfHeaders: jest.fn(),
  };
});

const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    TRUSTED_PROXY_IPS: "127.0.0.1",
  };
});

afterAll(() => {
  process.env = originalEnv;
});

// Helper function to create a mock NextRequest with json() method
function createMockRequest(body: Record<string, unknown>, headers: Record<string, string> = {}, ip: string = "192.168.1.1") {
  const request = {
    json: jest.fn().mockResolvedValue(body),
    ip: "127.0.0.1",
    headers: {
      get: jest.fn((name: string) => {
        if (name === "x-forwarded-for") return headers["x-forwarded-for"] || ip;
        if (name === "x-real-ip") return headers["x-real-ip"] || "127.0.0.1";
        return headers[name] || null;
      }),
    },
  } as unknown as NextRequest;
  return request;
}

describe("/api/contact/route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_EMAILS = "admin1@example.com,admin2@example.com";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "test@example.com";
    process.env.SMTP_PASSWORD = "password";
    process.env.SMTP_FROM = "noreply@rag-mse.de";
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("sends email to all valid recipients", async () => {
    (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const request = createMockRequest(requestBody, {}, "192.168.1.1");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("Ihre Nachricht wurde erfolgreich gesendet.");
    expect(sendTemplateEmail).toHaveBeenCalledWith({
      template: "contact",
      variables: {
        name: "Max Mustermann",
        email: "max@example.com",
        message: "Dies ist eine Testnachricht.",
      },
      to: ["admin1@example.com", "admin2@example.com"],
    });
  });

  it("filters out empty email entries", async () => {
    process.env.ADMIN_EMAILS = "admin1@example.com,,admin2@example.com";
    (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const request = createMockRequest(requestBody, {}, "192.168.1.2");

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendTemplateEmail).toHaveBeenCalledWith({
      template: "contact",
      variables: {
        name: "Max Mustermann",
        email: "max@example.com",
        message: "Dies ist eine Testnachricht.",
      },
      to: ["admin1@example.com", "admin2@example.com"],
    });
  });

  it("filters out whitespace-only email entries", async () => {
    process.env.ADMIN_EMAILS = "admin1@example.com,   ,admin2@example.com";
    (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const request = createMockRequest(requestBody, {}, "192.168.1.3");

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendTemplateEmail).toHaveBeenCalledWith({
      template: "contact",
      variables: {
        name: "Max Mustermann",
        email: "max@example.com",
        message: "Dies ist eine Testnachricht.",
      },
      to: ["admin1@example.com", "admin2@example.com"],
    });
  });

  it("handles trailing comma", async () => {
    process.env.ADMIN_EMAILS = "admin1@example.com,admin2@example.com,";
    (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const request = createMockRequest(requestBody, {}, "192.168.1.4");

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendTemplateEmail).toHaveBeenCalledWith({
      template: "contact",
      variables: {
        name: "Max Mustermann",
        email: "max@example.com",
        message: "Dies ist eine Testnachricht.",
      },
      to: ["admin1@example.com", "admin2@example.com"],
    });
  });

  it("handles leading comma", async () => {
    process.env.ADMIN_EMAILS = ",admin1@example.com,admin2@example.com";
    (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const request = createMockRequest(requestBody, {}, "192.168.1.5");

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendTemplateEmail).toHaveBeenCalledWith({
      template: "contact",
      variables: {
        name: "Max Mustermann",
        email: "max@example.com",
        message: "Dies ist eine Testnachricht.",
      },
      to: ["admin1@example.com", "admin2@example.com"],
    });
  });

  it("handles multiple consecutive empty entries", async () => {
    process.env.ADMIN_EMAILS = "admin1@example.com,,,,admin2@example.com";
    (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const request = createMockRequest(requestBody, {}, "192.168.1.6");

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendTemplateEmail).toHaveBeenCalledWith({
      template: "contact",
      variables: {
        name: "Max Mustermann",
        email: "max@example.com",
        message: "Dies ist eine Testnachricht.",
      },
      to: ["admin1@example.com", "admin2@example.com"],
    });
  });

  it("returns error when ADMIN_EMAILS is not configured", async () => {
    delete process.env.ADMIN_EMAILS;

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const request = createMockRequest(requestBody, {}, "192.168.1.7");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("E-Mail-Konfiguration unvollständig. Bitte kontaktieren Sie den Administrator.");
    expect(logError).toHaveBeenCalledWith(
      'contact_failed',
      'ADMIN_EMAILS not configured',
      expect.any(Object)
    );
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  it("returns error when ADMIN_EMAILS contains only empty entries", async () => {
    process.env.ADMIN_EMAILS = ", , ,";

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const request = createMockRequest(requestBody, {}, "192.168.1.8");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("E-Mail-Konfiguration fehlerhaft. Bitte kontaktieren Sie den Administrator.");
    expect(logError).toHaveBeenCalledWith(
      'contact_failed',
      'ADMIN_EMAILS contains no valid recipients',
      expect.objectContaining({
        adminEmails: ", , ,",
      })
    );
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  it("returns error when ADMIN_EMAILS contains only whitespace", async () => {
    process.env.ADMIN_EMAILS = "   ";

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const request = createMockRequest(requestBody, {}, "192.168.1.9");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("E-Mail-Konfiguration fehlerhaft. Bitte kontaktieren Sie den Administrator.");
    expect(logError).toHaveBeenCalledWith(
      'contact_failed',
      'ADMIN_EMAILS contains no valid recipients',
      expect.objectContaining({
        adminEmails: "   ",
      })
    );
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  it("handles single valid email", async () => {
    process.env.ADMIN_EMAILS = "admin1@example.com";
    (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const request = createMockRequest(requestBody, {}, "192.168.1.10");

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendTemplateEmail).toHaveBeenCalledWith({
      template: "contact",
      variables: {
        name: "Max Mustermann",
        email: "max@example.com",
        message: "Dies ist eine Testnachricht.",
      },
      to: ["admin1@example.com"],
    });
  });

  it("validates contact form data before sending", async () => {
    const requestBody = {
      name: "M",
      email: "invalid-email",
      message: "Short",
    };

    const request = createMockRequest(requestBody, {}, "192.168.1.11");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  it("enforces rate limiting", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const createRequest = () => {
      return createMockRequest(requestBody, {}, "192.168.2.1");
    };

    // First request should succeed
    const response1 = await POST(createRequest());
    expect(response1.status).toBe(200);

    // Make 4 more requests (total 5) - should still work
    for (let i = 0; i < 4; i++) {
      const response = await POST(createRequest());
      expect(response.status).toBe(200);
    }

    // 6th request should be rate limited
    const response6 = await POST(createRequest());
    const data = await response6.json();
    expect(response6.status).toBe(429);
    expect(data.error).toBe("Zu viele Anfragen. Bitte später erneut versuchen.");
  });

  it("continues when rate limiter backend is unavailable", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    (sendTemplateEmail as jest.Mock).mockResolvedValue({ messageId: "test-id" });
    const rateLimitSpy = jest.spyOn(rateLimiter, "checkContactRateLimit").mockRejectedValueOnce(new Error("Redis unavailable"));

    const request = createMockRequest({
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    }, {}, "192.168.2.99");

    const response = await POST(request);
    expect(response.status).toBe(200);
    rateLimitSpy.mockRestore();
  });

  it("handles email sending failure", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    (sendTemplateEmail as jest.Mock).mockRejectedValue(new Error("SMTP connection failed"));

    const requestBody = {
      name: "Max Mustermann",
      email: "max@example.com",
      message: "Dies ist eine Testnachricht.",
    };

    const request = createMockRequest(requestBody, {}, "192.168.3.1");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Fehler beim Senden der Nachricht. Bitte versuchen Sie es später erneut.");
  });
});
