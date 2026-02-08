import {
  generateResetToken,
  hashResetToken,
  getResetExpiryDate,
  buildResetUrl,
  RESET_TOKEN_VALIDITY_HOURS,
} from "../lib/password-reset";

describe("password-reset", () => {
  describe("generateResetToken", () => {
    it("should generate a random token", () => {
      const token = generateResetToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token.length).toBe(64);
    });

    it("should generate different tokens on multiple calls", () => {
      const token1 = generateResetToken();
      const token2 = generateResetToken();
      expect(token1).not.toBe(token2);
    });

    it("should generate hex string", () => {
      const token = generateResetToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("hashResetToken", () => {
    it("should hash a token", () => {
      const token = generateResetToken();
      const hash = hashResetToken(token);
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64);
    });

    it("should hash the same token to the same value", () => {
      const token = generateResetToken();
      const hash1 = hashResetToken(token);
      const hash2 = hashResetToken(token);
      expect(hash1).toBe(hash2);
    });

    it("should hash different tokens to different values", () => {
      const token1 = generateResetToken();
      const token2 = generateResetToken();
      const hash1 = hashResetToken(token1);
      const hash2 = hashResetToken(token2);
      expect(hash1).not.toBe(hash2);
    });

    it("should generate SHA256 hash", () => {
      const token = "test-token";
      const hash = hashResetToken(token);
      expect(hash).toBe("4c5dc9b7708905f77f5e5d16316b5dfb425e68cb326dcd55a860e90a7707031e");
    });
  });

  describe("getResetExpiryDate", () => {
    it("should return a date 24 hours in the future", () => {
      const now = new Date("2024-01-01T00:00:00.000Z");
      const expiry = getResetExpiryDate(now);
      const expected = new Date("2024-01-02T00:00:00.000Z");
      expect(expiry).toEqual(expected);
    });

    it("should default to current time if no date provided", () => {
      const now = new Date();
      const expiry = getResetExpiryDate();
      const diff = expiry.getTime() - now.getTime();
      const hours = diff / (1000 * 60 * 60);
      expect(hours).toBeCloseTo(RESET_TOKEN_VALIDITY_HOURS, 2);
    });

    it("should use RESET_TOKEN_VALIDITY_HOURS constant", () => {
      expect(RESET_TOKEN_VALIDITY_HOURS).toBe(24);
    });
  });

  describe("buildResetUrl", () => {
    it("should build reset URL with token", () => {
      const url = buildResetUrl("http://localhost:3000", "test-token");
      expect(url).toBe("http://localhost:3000/passwort-zuruecksetzen/test-token");
    });

    it("should remove trailing slash from app URL", () => {
      const url = buildResetUrl("http://localhost:3000/", "test-token");
      expect(url).toBe("http://localhost:3000/passwort-zuruecksetzen/test-token");
    });

    it("should preserve URL without trailing slash", () => {
      const url = buildResetUrl("http://localhost:3000", "test-token");
      expect(url).toBe("http://localhost:3000/passwort-zuruecksetzen/test-token");
    });

    it("should handle HTTPS URLs", () => {
      const url = buildResetUrl("https://example.com", "test-token");
      expect(url).toBe("https://example.com/passwort-zuruecksetzen/test-token");
    });

    it("should handle complex URLs", () => {
      const url = buildResetUrl("https://subdomain.example.com:8080/", "test-token");
      expect(url).toBe("https://subdomain.example.com:8080/passwort-zuruecksetzen/test-token");
    });
  });
});
