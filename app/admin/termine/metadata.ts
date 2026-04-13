import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Termine",
  description: `Termine-Verwaltung der ${appName}. Erstellen, bearbeiten und verwalten Sie Trainingstermine und Wettkämpfe.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `Termine | ${appName}`
  }
};
