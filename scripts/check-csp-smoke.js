#!/usr/bin/env node

const targetUrl = process.argv[2] || "http://127.0.0.1:3000/";

async function main() {
  const response = await fetch(targetUrl, {
    headers: {
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`Smoke check failed: ${targetUrl} returned ${response.status}`);
  }

  const csp = response.headers.get("content-security-policy") || "";
  const html = await response.text();
  const inlineScriptMatches = html.match(/<script\b(?![^>]*\bsrc=)[^>]*>\s*[\s\S]*?\S[\s\S]*?<\/script>/gi) || [];
  const hasNextInlineBootstrap = inlineScriptMatches.some((script) =>
    script.includes("__next_f.push") || script.includes("self.__next_f")
  );
  const allowsInlineScripts =
    csp.includes("'unsafe-inline'") || csp.includes("'nonce-") || csp.includes("'sha256-");

  if (!csp) {
    throw new Error("Smoke check failed: Content-Security-Policy header is missing");
  }

  if (hasNextInlineBootstrap && !allowsInlineScripts) {
    throw new Error(
      "Smoke check failed: production HTML contains inline Next.js bootstrap scripts but CSP does not allow them"
    );
  }

  if (!csp.includes("object-src 'none'")) {
    throw new Error("Smoke check failed: CSP is missing object-src 'none'");
  }

  if (!csp.includes("base-uri 'self'")) {
    throw new Error("Smoke check failed: CSP is missing base-uri 'self'");
  }

  if (!csp.includes("form-action 'self'")) {
    throw new Error("Smoke check failed: CSP is missing form-action 'self'");
  }

  if (!csp.includes("frame-ancestors 'self'")) {
    throw new Error("Smoke check failed: CSP is missing frame-ancestors 'self'");
  }

  console.log(`CSP smoke check passed for ${targetUrl}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
