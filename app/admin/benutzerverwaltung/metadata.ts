import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Benutzerverwaltung",
  description: `Benutzerverwaltung der ${appName}. Verwalten Sie Benutzerkonten und senden Sie Einladungen.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `Benutzerverwaltung | ${appName}`
  }
};
