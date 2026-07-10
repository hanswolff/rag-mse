import type { Metadata } from "next";
import { appName } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Ausschreibungen",
  description: `Aktuelle und frühere Ausschreibungen externer Wettbewerbe und Veranstaltungen der ${appName}.`,
  alternates: {
    canonical: "/ausschreibungen",
  },
  openGraph: {
    title: `Ausschreibungen | ${appName}`,
    description: "Aktuelle und frühere Ausschreibungen externer Wettbewerbe und Veranstaltungen",
  },
};
