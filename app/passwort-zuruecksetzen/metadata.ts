import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Passwort zurücksetzen",
  description: "Setzen Sie Ihr Passwort zurück.",
  robots: "noindex, nofollow",
  openGraph: {
    title: `Passwort zurücksetzen | ${appName}`
  }
};
