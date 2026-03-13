import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Next.js App Router emits inline bootstrap/hydration scripts in production HTML.
// A strict `script-src 'self'` breaks client hydration and disables interactive UI
// such as menus. We therefore allow inline scripts and tighten the remaining CSP
// directives instead. Any future CSP tightening must be verified against a real
// production response so hydration and interactive navigation keep working.
const scriptSrc = isProduction
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com";

const nextConfig = {
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://*.tile.openstreetmap.org https://*.openstreetmap.org",
              "font-src 'self' data:",
              "connect-src 'self' https://*.openstreetmap.org https://*.tile.openstreetmap.org",
              "frame-src 'self' https://*.openstreetmap.org",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
