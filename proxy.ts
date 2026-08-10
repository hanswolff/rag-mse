import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { requiresLogin, shouldRedirectToLogin } from "@/lib/auth-utils";
import { buildLoginUrlWithReturnUrl } from "@/lib/return-url";
import { buildContentSecurityPolicy, getNonceScriptSrc } from "@/lib/csp-directives.mjs";

// Prefetches liefern HTML, das der Browser zwischenspeichert und erst später
// verwendet — eine dann längst abgelaufene Nonce darin wäre wertlos. Der
// Auth-Schutz gilt für sie trotzdem, deshalb wird hier nur die Nonce weggelassen
// und nicht der ganze Proxy übersprungen.
function isPrefetch(req: NextRequest): boolean {
  return (
    req.headers.has("next-router-prefetch") || req.headers.get("purpose") === "prefetch"
  );
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const nonce = isPrefetch(req) ? null : crypto.randomUUID();

  // Next liest die Nonce aus dem Request-Header `Content-Security-Policy` und
  // setzt sie an seine eigenen Bootstrap-Skripte. Ohne diesen Request-Header
  // blieben genau die Skripte ohne Nonce, um die es hier geht.
  const policy = nonce
    ? buildContentSecurityPolicy({
        scriptSrc: getNonceScriptSrc(nonce, process.env.NODE_ENV === "production"),
      })
    : null;

  const requestHeaders = new Headers(req.headers);
  if (nonce && policy) {
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", policy);
  }

  // Vorstufe der Nonce-Umstellung: meldet Verstöße, blockiert nichts. Der
  // erzwingende Header aus next.config.mjs bleibt bei 'unsafe-inline'.
  const withReportOnly = (response: NextResponse) => {
    if (policy) {
      response.headers.set("Content-Security-Policy-Report-Only", policy);
    }
    return response;
  };

  if (!requiresLogin(pathname)) {
    return withReportOnly(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const requestedPath = `${pathname}${req.nextUrl.search}`;
  const loginUrl = new URL(buildLoginUrlWithReturnUrl(requestedPath), req.url);

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("NEXTAUTH_SECRET fehlt. Zugriff auf geschuetzte Routen wird blockiert.");
    return withReportOnly(NextResponse.redirect(loginUrl));
  }

  let token = null;
  try {
    token = await getToken({ req, secret });
  } catch (error) {
    console.error("Fehler beim Lesen des Auth-Tokens:", error);
    return withReportOnly(NextResponse.redirect(loginUrl));
  }

  // Role-based checks are enforced on server routes/pages.
  // In proxy we only guard unauthenticated access to protected routes.
  if (!token?.sub && shouldRedirectToLogin(pathname, undefined)) {
    return withReportOnly(NextResponse.redirect(loginUrl));
  }

  return withReportOnly(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  // Läuft auf allen Seiten, damit jede HTML-Antwort eine Nonce bekommt.
  // Ausgenommen sind nur Pfade ohne HTML, in das eine Nonce gehören könnte.
  //
  // `apple-icon` steht einzeln in der Liste, weil Next diese Metadata-Route
  // ohne Dateiendung ausliefert (`/apple-icon`); die Endungs-Alternative
  // greift dort also nicht.
  //
  // Das `(?:/|$)` hinter den Namen ist die Segmentgrenze: Ohne sie wären auch
  // `/apiary` oder `/apple-iconography` ausgenommen, weil sie mit `api` bzw.
  // `apple-icon` beginnen — eine solche Seite bekäme stillschweigend keine Nonce.
  matcher: [
    "/((?!(?:api|_next/static|_next/image|apple-icon)(?:/|$)|favicon\\.ico$|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|pdf|txt|xml|webmanifest)$).*)",
  ],
};
