import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "News",
  description: `Aktuelle Neuigkeiten und Meldungen der ${appName}. Bleiben Sie auf dem Laufenden über unsere Aktivitäten.`,
  alternates: {
    canonical: "/news",
  },
  openGraph: {
    title: `News | ${appName}`,
    description: "Aktuelle Neuigkeiten und Meldungen"
  }
};
