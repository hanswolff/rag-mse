import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Admin-Ausschreibungen",
  description: `Verwaltung der Ausschreibungen der ${appName}. Anlegen, bearbeiten und löschen von Ausschreibungen.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `Admin-Ausschreibungen | ${appName}`,
  },
};
