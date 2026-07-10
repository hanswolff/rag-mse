import { ImageResponse } from "next/og";
import { renderAppIcon } from "@/lib/app-icon";

export async function GET() {
  return new ImageResponse(
    await renderAppIcon({
      background: "transparent",
      logoScale: 0.9,
      inset: "2%",
    }),
    {
      width: 512,
      height: 512,
    },
  );
}
