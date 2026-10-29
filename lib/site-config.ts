const appName =
  process.env.NEXT_PUBLIC_APP_NAME ||
  process.env.APP_NAME ||
  "RAG Schießsport MSE";

const appTagline =
  process.env.NEXT_PUBLIC_APP_TAGLINE ||
  "Sportliches Schießen an der Mecklenburgischen Seenplatte";

const appDescription =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
  "Reservistenarbeitsgemeinschaft für sportliches Schießen an der Mecklenburgischen Seenplatte";

// URL-Strategie (eine Quelle statt drei Konventionen):
// - `siteUrl`: öffentlich sichtbare Links (Metadata, Sitemap, Robots, Canonical).
//   Fällt bewusst auf die Produktions-Domain zurück, damit Build/SEO nie leere
//   URLs erzeugen.
// - `getAppUrl()`: serverseitig erzeugte Links, die Empfänger wirklich erreichen
//   müssen (E-Mails mit Einladungs-/Reset-/Umfrage-Links). Ohne Konfiguration
//   wird hart abgebrochen (withApiErrorHandling mappt auf 500) statt still
//   falsche Links zu versenden.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rag-mse.de";

export class AppUrlNotConfiguredError extends Error {
  constructor() {
    super("APP_URL ist nicht konfiguriert");
    this.name = "AppUrlNotConfiguredError";
  }
}

export function getAppUrl(): string {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    throw new AppUrlNotConfiguredError();
  }
  return appUrl;
}

export { appName, appTagline, appDescription, siteUrl };
