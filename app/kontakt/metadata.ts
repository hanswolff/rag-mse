import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Kontakt",
  description: `Kontaktieren Sie die ${appName}. Nutzen Sie unser Kontaktformular für Anfragen und Fragen.`,
  alternates: {
    canonical: "/kontakt",
  },
  openGraph: {
    title: `Kontakt | ${appName}`,
    description: "Kontaktieren Sie uns"
  }
};
