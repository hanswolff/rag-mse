import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: `Admin Dashboard der ${appName}. Verwalten Sie Benutzer, Termine und News.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `Admin Dashboard | ${appName}`
  }
};
