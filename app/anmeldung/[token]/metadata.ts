import { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Terminanmeldung | ${appName}`,
  description: "Direkte Teilnahmeanmeldung zu einem Termin.",
  robots: "noindex, nofollow",
};
