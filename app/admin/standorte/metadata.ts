import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Standorte",
  description: `Verwaltung der Schießstände der ${appName}. Erstellen, bearbeiten und löschen Sie Schießstände.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `Standorte | ${appName}`
  }
};
