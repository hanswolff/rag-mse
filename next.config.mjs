import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentSecurityPolicy, getPermissiveScriptSrc } from "./lib/csp-directives.mjs";

/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Der App Router gibt Bootstrap-Skripte inline aus; ein striktes `script-src 'self'`
// bräche die Hydration. Der Umstieg auf Nonces läuft parallel als Report-Only aus
// proxy.ts — Stand und offene Entscheidung in docs/CSP_NONCE_ROLLOUT.md.
const contentSecurityPolicy = buildContentSecurityPolicy({
  scriptSrc: getPermissiveScriptSrc(isProduction),
});

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
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
