import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { shouldRedirectToLogin } from "@/lib/auth-utils";
import { buildLoginUrlWithReturnUrl } from "@/lib/return-url";

export async function proxy(req: NextRequest) {
  const requestedPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const loginUrl = new URL(buildLoginUrlWithReturnUrl(requestedPath), req.url);

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("NEXTAUTH_SECRET fehlt. Zugriff auf geschuetzte Routen wird blockiert.");
    return NextResponse.redirect(loginUrl);
  }

  let token = null;
  try {
    token = await getToken({ req, secret });
  } catch (error) {
    console.error("Fehler beim Lesen des Auth-Tokens:", error);
    return NextResponse.redirect(loginUrl);
  }
  const userRole = token?.role;
  const pathname = req.nextUrl.pathname;

  if (shouldRedirectToLogin(pathname, userRole)) {
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/profil/:path*", "/passwort-aendern/:path*"],
};
