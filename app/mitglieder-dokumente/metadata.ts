import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Dokumente für Mitglieder | ${appName}`,
  description: `Dokumente für Mitglieder der ${appName}`,
  robots: "noindex, nofollow",
};
