import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Termine",
  description: `Aktuelle Termine und Veranstaltungen der ${appName}. Trainings, Wettkämpfe und Treffen in Mecklenburg-Vorpommern.`,
  alternates: {
    canonical: "/termine",
  },
  openGraph: {
    title: `Termine | ${appName}`,
    description: "Aktuelle Termine und Veranstaltungen"
  }
};
