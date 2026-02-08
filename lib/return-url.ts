const LOGIN_PATH = "/login";

function getRelativeUrl(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function sanitizeReturnUrl(
  returnUrl: string | null | undefined,
  baseOrigin: string
): string | null {
  if (!returnUrl || typeof returnUrl !== "string") {
    return null;
  }

  try {
    const parsed = new URL(returnUrl, baseOrigin);
    if (parsed.origin !== baseOrigin) {
      return null;
    }

    if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
      return null;
    }

    if (parsed.pathname === LOGIN_PATH) {
      return null;
    }

    return getRelativeUrl(parsed);
  } catch {
    return null;
  }
}

export function buildLoginUrlWithReturnUrl(returnUrl: string | null | undefined): string {
  if (!returnUrl || !returnUrl.startsWith("/") || returnUrl.startsWith("//")) {
    return LOGIN_PATH;
  }

  const safeReturnUrl = returnUrl === LOGIN_PATH ? "/" : returnUrl;
  return `${LOGIN_PATH}?returnUrl=${encodeURIComponent(safeReturnUrl)}`;
}

export function getCurrentPathWithSearch(): string {
  if (typeof window === "undefined") {
    return "/";
  }
  return `${window.location.pathname}${window.location.search}`;
}
