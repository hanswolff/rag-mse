import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Adminbereich",
  description: `Administrationsbereich der ${appName}.`,
  robots: "noindex, nofollow",
  openGraph: {
    title: `Adminbereich | ${appName}`
  }
};
