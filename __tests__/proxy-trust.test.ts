import { getClientIdentifier, getClientIdentifierFromHeaders, getDirectIp, clearTrustedProxyCache } from "@/lib/proxy-trust";
import { NextRequest } from "next/server";

describe("proxy-trust", () => {
  beforeEach(() => {
    clearTrustedProxyCache();
    delete process.env.TRUSTED_PROXY_IPS;
  });

  afterEach(() => {
    clearTrustedProxyCache();
    delete process.env.TRUSTED_PROXY_IPS;
  });

  describe("getClientIdentifier", () => {
    it("returns fallback identifier when source IP is missing", () => {
      process.env.TRUSTED_PROXY_IPS = "192.168.1.100";

      const request = new NextRequest("http://example.com", {
        headers: {
          "x-forwarded-for": "203.0.113.1, 198.51.100.1",
          "x-real-ip": "192.168.1.100",
        },
      });

      expect(getClientIdentifier(request)).toContain("fallback:");
    });

    it("returns fallback identifier when no IP headers are present", () => {
      const request = new NextRequest("http://example.com", {
        headers: {
          "user-agent": "Mozilla/5.0",
          "accept-language": "en-US",
        },
      });

      expect(getClientIdentifier(request)).toBe("fallback:Mozilla/5.0:en-US");
    });

    it("handles missing user-agent and accept-language in fallback", () => {
      const request = new NextRequest("http://example.com");

      expect(getClientIdentifier(request)).toBe("fallback:unknown:unknown");
    });

    it("handles CIDR ranges in trusted proxy config", () => {
      process.env.TRUSTED_PROXY_IPS = "192.168.0.0/16";

      const headers = new Headers({
        "x-forwarded-for": "203.0.113.1",
        "x-real-ip": "198.51.100.5",
      });

      expect(getClientIdentifierFromHeaders(headers, "192.168.1.50")).toBe("203.0.113.1");
    });

    it("returns source IP when proxy is not trusted", () => {
      process.env.TRUSTED_PROXY_IPS = "192.168.1.100";

      const headers = new Headers({
        "x-forwarded-for": "203.0.113.1",
        "x-real-ip": "192.168.1.50",
      });

      expect(getClientIdentifierFromHeaders(headers, "192.168.1.50")).toBe("192.168.1.50");
    });

    it("returns real IP when source IP is trusted and x-forwarded-for is absent", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.0/8";

      const headers = new Headers({
        "x-real-ip": "198.51.100.8",
      });

      expect(getClientIdentifierFromHeaders(headers, "10.1.2.3")).toBe("198.51.100.8");
    });

    it("supports IPv4-mapped source IPs", () => {
      process.env.TRUSTED_PROXY_IPS = "127.0.0.0/8";

      const headers = new Headers({
        "x-forwarded-for": "203.0.113.22",
      });

      expect(getClientIdentifierFromHeaders(headers, "::ffff:127.0.0.1")).toBe("203.0.113.22");
    });
  });

  describe("getDirectIp", () => {
    it("returns real IP from x-real-ip header", () => {
      const request = new NextRequest("http://example.com", {
        headers: {
          "x-real-ip": "192.168.1.100",
        },
      });

      expect(getDirectIp(request)).toBe("192.168.1.100");
    });

    it("returns null when x-real-ip is not present", () => {
      const request = new NextRequest("http://example.com");

      expect(getDirectIp(request)).toBeNull();
    });

    it("returns null when x-real-ip is empty", () => {
      const request = new NextRequest("http://example.com", {
        headers: {
          "x-real-ip": "",
        },
      });

      expect(getDirectIp(request)).toBeNull();
    });
  });
});
