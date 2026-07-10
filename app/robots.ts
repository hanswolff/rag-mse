import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rag-mse.de";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/termine", "/news", "/kontakt", "/ueber-uns", "/info/", "/impressum", "/datenschutz"],
        disallow: [
          "/admin/",
          "/login",
          "/profil",
          "/passwort-aendern",
          "/passwort-vergessen",
          "/passwort-zuruecksetzen",
          "/mitglieder-dokumente",
          "/benachrichtigungen",
          "/einladung/",
          "/anmeldung/",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
