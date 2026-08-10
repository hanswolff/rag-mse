import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Standorte",
  description: `Verwaltung der Standorte der ${appName}. Erstellen, bearbeiten und löschen Sie Standorte.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `Standorte | ${appName}`
  }
};
