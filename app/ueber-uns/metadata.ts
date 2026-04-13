import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Über uns",
  description:
    `Informationen über die ${appName} und den Vorstand.`,
  openGraph: {
    title: `Über uns | ${appName}`,
    description:
      `Informationen über die ${appName} und den Vorstand.`,
  },
};
