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
    it("uses deterministic fallback fingerprint when source IP is missing", () => {
      process.env.TRUSTED_PROXY_IPS = "192.168.1.100";

      const request = new NextRequest("http://example.com", {
        headers: {
          "x-forwarded-for": "203.0.113.1, 198.51.100.1",
          "x-real-ip": "192.168.1.100",
          "user-agent": "Mozilla/5.0 (X11; Linux x86_64)",
          "accept-language": "de-DE,de;q=0.9",
        },
      });

      expect(getClientIdentifier(request)).toMatch(/^fallback:[0-9a-f]{24}$/);
    });

    it("returns fallback identifier when no IP headers are present", () => {
      const request = new NextRequest("http://example.com", {
        headers: {
          "user-agent": "Mozilla/5.0",
          "accept-language": "en-US",
        },
      });

      expect(getClientIdentifier(request)).toMatch(/^fallback:[0-9a-f]{24}$/);
    });

    it("handles missing user-agent and accept-language in fallback", () => {
      const request = new NextRequest("http://example.com");

      expect(getClientIdentifier(request)).toBe("fallback:unknown-client");
    });

    it("handles CIDR ranges in trusted proxy config", () => {
      process.env.TRUSTED_PROXY_IPS = "192.168.0.0/16";

      const headers = new Headers({
        "x-forwarded-for": "198.51.100.99, 203.0.113.1",
        "x-real-ip": "198.51.100.5",
      });

      expect(getClientIdentifierFromHeaders(headers, "192.168.1.50")).toBe("203.0.113.1");
    });

    it("resolves client IP from forwarded chain by skipping trusted proxy hops", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.0/8";

      const headers = new Headers({
        "x-forwarded-for": "198.51.100.200, 10.3.4.5",
      });

      expect(getClientIdentifierFromHeaders(headers, "10.20.30.40")).toBe("198.51.100.200");
    });

    it("falls back to source IP when chain contains only trusted proxies", () => {
      process.env.TRUSTED_PROXY_IPS = "10.0.0.0/8";

      const headers = new Headers({
        "x-forwarded-for": "10.1.1.1, 10.2.2.2",
      });

      expect(getClientIdentifierFromHeaders(headers, "10.20.30.40")).toBe("10.20.30.40");
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

    it("does not trust Docker bridge source IPs by default", () => {
      const headers = new Headers({
        "x-forwarded-for": "203.0.113.30",
      });

      expect(getClientIdentifierFromHeaders(headers, "172.18.0.2")).toBe("172.18.0.2");
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
