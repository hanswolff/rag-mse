import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: `Datenschutzerklärung der ${appName}. Informationen zur Verarbeitung personenbezogener Daten.`,
  alternates: {
    canonical: "/datenschutz",
  },
  openGraph: {
    title: `Datenschutzerklärung | ${appName}`,
    description: "Informationen zum Datenschutz"
  }
};
