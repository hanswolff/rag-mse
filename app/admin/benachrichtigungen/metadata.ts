import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Benachrichtigungen",
  description: "Übersicht über versendete Termin-Erinnerungen und Umfrage-Benachrichtigungen der letzten 30 Tage.",
  robots: "noindex, nofollow",
  openGraph: {
    title: `Benachrichtigungen | ${appName}`,
  },
};
