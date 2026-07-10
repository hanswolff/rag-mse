import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Startseite",
  description: `Willkommen auf der Website der ${appName}. Informieren Sie sich über Termine, News und kontaktieren Sie uns.`,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${appName} - Startseite`,
    description: `Willkommen auf der Website der ${appName}`
  }
};
