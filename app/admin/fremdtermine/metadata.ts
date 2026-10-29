import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Fremdtermine",
  description: `Verwaltung der Fremdtermine der ${appName}. Erstellen, bearbeiten und löschen Sie Fremdtermine.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `Fremdtermine | ${appName}`
  }
};
