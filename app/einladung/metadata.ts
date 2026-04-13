import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Einladung",
  description: `Einladung zur Mitgliedschaft bei der ${appName}.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `Einladung | ${appName}`
  }
};
