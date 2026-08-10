// next-auth/jwt zieht jose als ESM nach, das Jest hier nicht transformiert;
// für den Matcher wird davon nichts gebraucht.
jest.mock("next-auth/jwt", () => ({ getToken: jest.fn() }));
jest.mock("next/server", () => ({ NextResponse: { redirect: jest.fn(), next: jest.fn() } }));

import { existsSync } from "fs";
import { join } from "path";
import { config } from "@/proxy";

describe("Proxy configuration", () => {
  const proxyPath = join(__dirname, "../proxy.ts");

  it("has proxy.ts", () => {
    expect(existsSync(proxyPath)).toBe(true);
  });

  // Der Matcher läuft seit der CSP-Nonce-Umstellung auf allen Seiten; geprüft
  // wird deshalb, welche Pfade er trifft, nicht mehr sein Quelltext.
  const pattern = new RegExp(`^${config.matcher[0]}$`);

  it.each([
    "/mitglieder-dokumente",
    "/mitglieder-dokumente/unterordner",
    "/admin/termine",
    "/profil",
    "/passwort-aendern",
    "/benachrichtigungen",
    "/termine/abc123",
    "/",
  ])("runs on %s", (pathname) => {
    expect(pattern.test(pathname)).toBe(true);
  });

  it.each([
    "/api/events",
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
    "/logo.png",
    "/dokumente/merkblatt.pdf",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    // Next liefert app/apple-icon.tsx unter einem Pfad ohne Dateiendung aus.
    "/apple-icon",
  ])("skips %s", (pathname) => {
    expect(pattern.test(pathname)).toBe(false);
  });

  // Die Ausnahmen gelten je Pfadsegment. Ohne Segmentgrenze im Matcher wären
  // auch diese Seiten ausgenommen, weil sie mit einem der Namen beginnen —
  // sie bekämen dann stillschweigend keine Nonce.
  it.each(["/apiary", "/apple-iconography", "/apps", "/favicon.icon-galerie"])(
    "still runs on %s",
    (pathname) => {
      expect(pattern.test(pathname)).toBe(true);
    }
  );
});
