import type { MetadataRoute } from "next";
import { appDescription, appName } from "@/lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName,
    short_name: "RAG MSE",
    description: appDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#13202d",
    icons: [
      {
        src: "/android-icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/android-icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
