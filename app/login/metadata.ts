import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Login",
  robots: "noindex, nofollow",
  openGraph: {
    title: `Login | ${appName}`
  }
};
