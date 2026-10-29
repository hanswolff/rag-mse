import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Kalender",
  description: `Kalender der ${appName}: Termine und Fremdtermine im Monats-, Wochen- und Listenüberblick.`,
  alternates: {
    canonical: "/kalender",
  },
  openGraph: {
    title: `Kalender | ${appName}`,
    description: "Termine und Fremdtermine im Überblick",
  },
};
