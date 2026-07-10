export class CsrfError extends Error {
  constructor(message = "Ungültiger Origin oder Referer Header. Bitte versuchen Sie es erneut.") {
    super(message);
    this.name = "CsrfError";
  }
}

export function validateCsrfHeaders(request: Request): void {
  const method = (request.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return;
  }

  const isProduction = process.env.NODE_ENV === "production" && process.env.DEVELOPMENT_DEPLOYMENT !== "true";

  const appUrl = process.env.APP_URL;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!appUrl) {
    if (isProduction) {
      throw new CsrfError("CSRF-Schutz ist nicht korrekt konfiguriert. Bitte Administrator kontaktieren.");
    }
    return;
  }

  let appUrlObj: URL;
  try {
    appUrlObj = new URL(appUrl);
  } catch {
    if (isProduction) {
      throw new CsrfError("CSRF-Schutz ist nicht korrekt konfiguriert. Bitte Administrator kontaktieren.");
    }
    return;
  }

  const userAgent = request.headers.get("user-agent") || "";
  const isLikelyBrowser = userAgent.includes("Mozilla") ||
    userAgent.includes("Chrome") ||
    userAgent.includes("Safari") ||
    userAgent.includes("Firefox") ||
    userAgent.includes("Edge");

  if (!isLikelyBrowser) {
    return;
  }

  const validateHeader = (header: string | null): boolean => {
    if (!header) return false;
    try {
      const headerUrl = new URL(header);
      return headerUrl.origin === appUrlObj.origin;
    } catch {
      return false;
    }
  };

  const isOriginValid = validateHeader(origin);
  const isRefererValid = validateHeader(referer);

  if (!isOriginValid && !isRefererValid) {
    throw new CsrfError("Ungültiger Origin oder Referer Header. Bitte versuchen Sie es erneut.");
  }
}
