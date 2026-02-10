import { validateProductionConfig } from "../lib/config-validation";

describe("Configuration Validation", () => {
  const originalEnv = process.env;

  const setProductionEnv = (overrides: Record<string, string> = {}) => {
    process.env.NODE_ENV = "production";
    process.env.NEXTAUTH_SECRET = "production-secret-key-with-enough-length-32chars";
    process.env.NEXTAUTH_URL = "https://example.com";
    process.env.APP_URL = "https://example.com";
    process.env.COOKIE_SECURE = "true";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASSWORD = "password";
    process.env.SMTP_FROM = "noreply@example.com";
    process.env.ADMIN_EMAILS = "admin@example.com";
    Object.assign(process.env, overrides);
  };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Development environment", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should succeed with minimal configuration in development", () => {
      process.env.NEXTAUTH_SECRET = "dev-secret-key-with-enough-length";
      const result = validateProductionConfig();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail without NEXTAUTH_SECRET", () => {
      delete process.env.NEXTAUTH_SECRET;
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("NEXTAUTH_SECRET"))).toBe(true);
    });

    it("should fail with short NEXTAUTH_SECRET", () => {
      process.env.NEXTAUTH_SECRET = "short";
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("NEXTAUTH_SECRET"))).toBe(true);
    });

    it("should warn about missing NEXTAUTH_URL", () => {
      process.env.NEXTAUTH_SECRET = "dev-secret-key-with-enough-length";
      delete process.env.NEXTAUTH_URL;
      const result = validateProductionConfig();
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes("NEXTAUTH_URL"))).toBe(true);
    });
  });

  describe("Production environment", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should require all mandatory production values", () => {
      setProductionEnv();
      const result = validateProductionConfig();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should require NEXTAUTH_SECRET in production", () => {
      setProductionEnv();
      delete process.env.NEXTAUTH_SECRET;
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("NEXTAUTH_SECRET"))).toBe(true);
    });

    it("should require HTTPS URLs in production", () => {
      setProductionEnv({ NEXTAUTH_URL: "http://example.com" });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("NEXTAUTH_URL") && e.includes("HTTPS"))).toBe(true);
    });

    it("should require COOKIE_SECURE=true in production", () => {
      setProductionEnv({ COOKIE_SECURE: "false" });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("COOKIE_SECURE"))).toBe(true);
    });

    it("should require SMTP configuration in production", () => {
      setProductionEnv();
      delete process.env.SMTP_HOST;
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("SMTP"))).toBe(true);
    });

    it("should reject EMAIL_DEV_MODE=true in production", () => {
      setProductionEnv({ EMAIL_DEV_MODE: "true" });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("EMAIL_DEV_MODE"))).toBe(true);
    });

    it("should reject localhost URLs in production", () => {
      setProductionEnv({ APP_URL: "http://localhost:3000" });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("APP_URL") && e.includes("localhost"))).toBe(true);
    });

    it("should warn about default passwords in seed config", () => {
      setProductionEnv({
        SEED_ADMIN_EMAIL: "admin@example.com",
        SEED_ADMIN_PASSWORD: "AdminPass123",
        SEED_ADMIN_NAME: "Administrator",
      });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes("unsicheres Standardpasswort"))).toBe(true);
    });

    it("should require all seed variables together or none", () => {
      setProductionEnv({
        SEED_ADMIN_EMAIL: "admin@example.com",
        SEED_ADMIN_PASSWORD: "secure-password",
      });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("SEED_ADMIN"))).toBe(true);
    });

    it("should validate email format for seed admin", () => {
      setProductionEnv({
        SEED_ADMIN_EMAIL: "invalid-email",
        SEED_ADMIN_PASSWORD: "secure-password",
        SEED_ADMIN_NAME: "Administrator",
      });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("SEED_ADMIN_EMAIL") && e.includes("gültiges E-Mail-Format"))).toBe(true);
    });

    it("should validate ALLOW_DB_PUSH flag format", () => {
      setProductionEnv({ ALLOW_DB_PUSH: "invalid" });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes("ALLOW_DB_PUSH") && w.includes("ungültigen Wert"))).toBe(true);
    });

    it("should validate ALLOW_DB_SEED flag format", () => {
      setProductionEnv({ ALLOW_DB_SEED: "yes" });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes("ALLOW_DB_SEED") && w.includes("ungültigen Wert"))).toBe(true);
    });

    it("should accept true/false values for ALLOW_DB_PUSH", () => {
      setProductionEnv({ ALLOW_DB_PUSH: "true", ALLOW_DB_SEED: "false" });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("should reject invalid APP_UID values", () => {
      setProductionEnv({ APP_UID: "abc", APP_GID: "1000" });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("APP_UID") && e.includes("positive Ganzzahl"))).toBe(true);
    });

    it("should reject invalid APP_GID values", () => {
      setProductionEnv({ APP_UID: "1000", APP_GID: "0" });
      const result = validateProductionConfig();
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes("APP_GID") && e.includes("positive Ganzzahl"))).toBe(true);
    });

    it("should warn when only APP_UID or APP_GID is set", () => {
      setProductionEnv({ APP_UID: "1000" });
      delete process.env.APP_GID;
      const result = validateProductionConfig();
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes("APP_UID und APP_GID"))).toBe(true);
    });
  });
});
