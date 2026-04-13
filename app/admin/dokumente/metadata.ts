import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Admin-Dokumente",
  description: `Admin-Dokumentenverwaltung der ${appName}. Upload, Suche, Ansicht und Verwaltung von Dokumenten.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `Admin-Dokumente | ${appName}`,
  },
};
