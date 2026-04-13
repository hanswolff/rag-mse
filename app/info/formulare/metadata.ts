import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Formulare",
  description: `Formulare der ${appName} und wichtige Dokumente zum Download.`,
  alternates: { canonical: "/info/formulare" },
};
