import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "E-Mail-Versand",
  description: "Übersicht über Outbox-E-Mails der letzten 30 Tage.",
  robots: "noindex, nofollow",
  openGraph: {
    title: `E-Mail-Versand | ${appName}`,
  },
};
