import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

describe("Next.js Configuration", () => {
  const nextConfigPath = join(__dirname, "../next.config.mjs");

  const loadNextConfig = async (nodeEnv: "production" | "development") => {
    const output = execFileSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `
          process.env.NODE_ENV = ${JSON.stringify(nodeEnv)};
          const { default: nextConfig } = await import(${JSON.stringify(nextConfigPath)});
          const headers = await nextConfig.headers();
          process.stdout.write(JSON.stringify({ output: nextConfig.output, headers }));
        `,
      ],
      {
        cwd: join(__dirname, ".."),
        encoding: "utf-8",
      }
    );

    return JSON.parse(output) as {
      output: string;
      headers: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };
  };

  const getCspHeader = async (nodeEnv: "production" | "development") => {
    const nextConfig = await loadNextConfig(nodeEnv);
    const globalHeaders = nextConfig.headers.find((entry) => entry.source === "/:path*");
    const cspHeader = globalHeaders?.headers.find(
      (header) => header.key === "Content-Security-Policy"
    );

    return {
      headers: nextConfig.headers,
      cspHeader,
    };
  };

  describe("File existence and readability", () => {
    it("should have next.config.mjs file", () => {
      expect(existsSync(nextConfigPath)).toBe(true);
    });
  });

  describe("Required configuration", () => {
    it("should have standalone output configured", async () => {
      const nextConfig = await loadNextConfig("production");
      expect(nextConfig.output).toBe("standalone");
    });
  });

  describe("Security headers", () => {
    it("should define headers() function", async () => {
      const nextConfig = await loadNextConfig("production");
      expect(nextConfig.headers).toEqual(expect.any(Array));
    });

    it("should set security headers on all paths", async () => {
      const { headers } = await getCspHeader("production");
      expect(headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: "/:path*",
            headers: expect.arrayContaining([
              expect.objectContaining({ key: "X-Frame-Options", value: "SAMEORIGIN" }),
              expect.objectContaining({ key: "X-Content-Type-Options", value: "nosniff" }),
              expect.objectContaining({
                key: "Referrer-Policy",
                value: "strict-origin-when-cross-origin",
              }),
              expect.objectContaining({ key: "Content-Security-Policy" }),
            ]),
          }),
        ])
      );
    });
  });

  describe("Content-Security-Policy directives", () => {
    it("should emit the hardened production CSP", async () => {
      const { cspHeader } = await getCspHeader("production");
      expect(cspHeader?.value).toContain("default-src 'self'");
      expect(cspHeader?.value).toContain("script-src 'self' 'unsafe-inline'");
      expect(cspHeader?.value).toContain("style-src 'self' 'unsafe-inline'");
      expect(cspHeader?.value).toContain("img-src 'self' data:");
      expect(cspHeader?.value).toContain("https://*.tile.openstreetmap.org");
      expect(cspHeader?.value).toContain("https://*.openstreetmap.org");
      expect(cspHeader?.value).toContain("font-src 'self' data:");
      expect(cspHeader?.value).toContain("connect-src 'self' https://*.openstreetmap.org https://*.tile.openstreetmap.org");
      expect(cspHeader?.value).toContain("frame-src 'self' https://*.openstreetmap.org");
      expect(cspHeader?.value).toContain("object-src 'none'");
      expect(cspHeader?.value).toContain("base-uri 'self'");
      expect(cspHeader?.value).toContain("form-action 'self'");
      expect(cspHeader?.value).toContain("frame-ancestors 'self'");
    });

    it("should emit the more permissive development CSP", async () => {
      const { cspHeader } = await getCspHeader("development");
      expect(cspHeader?.value).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com");
      expect(cspHeader?.value).toContain("style-src 'self' 'unsafe-inline'");
      expect(cspHeader?.value).toContain("https://unpkg.com");
    });
  });
});
