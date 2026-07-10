import { ImageResponse } from "next/og";
import { renderAppIcon } from "@/lib/app-icon";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    await renderAppIcon({
      background: "transparent",
      logoScale: 0.86,
      inset: "4%",
    }),
    size,
  );
}
