import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Impressum",
  description: `Impressum der ${appName}. Rechtsinformationen gemäß § 5 DDG.`,
  alternates: {
    canonical: "/impressum",
  },
  openGraph: {
    title: `Impressum | ${appName}`,
    description: "Rechtliche Informationen"
  }
};
