import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Passwort vergessen",
  description: "Setzen Sie Ihr vergessenes Passwort zurück.",
  robots: "noindex, nofollow",
  openGraph: {
    title: `Passwort vergessen | ${appName}`
  }
};
