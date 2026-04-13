import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Passwort ändern",
  description: "Passwort für Ihr Mitgliederkonto ändern.",
  robots: "noindex, nofollow",
  openGraph: {
    title: `Passwort ändern | ${appName}`,
  },
};
