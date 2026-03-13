import { existsSync, readFileSync } from "fs";
import { join } from "path";

describe("Proxy configuration", () => {
  const proxyPath = join(__dirname, "../proxy.ts");

  it("has proxy.ts", () => {
    expect(existsSync(proxyPath)).toBe(true);
  });

  it("protects mitglieder-dokumente route in matcher config", () => {
    const content = readFileSync(proxyPath, "utf-8");
    expect(content).toContain('"/mitglieder-dokumente/:path*"');
  });
});
