import { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Benachrichtigungen | ${appName}`,
  description: "Persönliche Benachrichtigungseinstellungen für Termine verwalten.",
  robots: "noindex, nofollow",
};
