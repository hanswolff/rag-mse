import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "News",
  description: `News-Verwaltung der ${appName}. Veröffentlichen und verwalten Sie News und Ankündigungen.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `News | ${appName}`
  }
};
