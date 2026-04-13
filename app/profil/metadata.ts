import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Profil",
  description: `Verwalten Sie Ihr Profil bei der ${appName}. Aktualisieren Sie Ihre persönlichen Daten.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `Profil | ${appName}`
  }
};
