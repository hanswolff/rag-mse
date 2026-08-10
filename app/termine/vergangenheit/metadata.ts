import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Vergangene Termine",
  description: `Rückblick auf vergangene Termine der ${appName}.`,
  alternates: {
    canonical: "/termine/vergangenheit",
  },
  openGraph: {
    title: `Vergangene Termine | ${appName}`,
    description: "Rückblick auf vergangene Termine",
  },
};
