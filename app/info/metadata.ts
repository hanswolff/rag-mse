import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Infos",
  description: `Öffentliche Informationen, Leitfäden und Formulare der ${appName}.`,
  alternates: {
    canonical: "/info",
  },
  openGraph: {
    title: `Infos | ${appName}`,
    description: "Öffentliche Informationen, Leitfäden und Formulare.",
  },
};
