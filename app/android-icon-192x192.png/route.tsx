import { ImageResponse } from "next/og";
import { renderAppIcon } from "@/lib/app-icon";

export async function GET() {
  return new ImageResponse(
    await renderAppIcon({
      background: "transparent",
      logoScale: 0.88,
      inset: "2%",
    }),
    {
      width: 192,
      height: 192,
    },
  );
}
