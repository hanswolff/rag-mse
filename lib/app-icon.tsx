import path from "node:path";
import { readFile } from "node:fs/promises";
import type { CSSProperties, ReactElement } from "react";

type AppIconOptions = {
  background?: string;
  logoScale?: number;
  inset?: string;
};

let logoDataUrlPromise: Promise<string> | null = null;

async function loadLogoDataUrl() {
  const svgPath = path.join(process.cwd(), "public", "vdrbw-logo.svg");
  const svgMarkup = await readFile(svgPath, "utf8");

  return `data:image/svg+xml;base64,${Buffer.from(svgMarkup).toString("base64")}`;
}

export async function getAppLogoDataUrl() {
  logoDataUrlPromise ??= loadLogoDataUrl();

  return logoDataUrlPromise;
}

export async function renderAppIcon({
  background = "transparent",
  logoScale = 1,
  inset = "0%",
}: AppIconOptions = {}): Promise<ReactElement> {
  const logoDataUrl = await getAppLogoDataUrl();

  const frameStyle: CSSProperties = {
    display: "flex",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    background,
  };

  const logoStyle: CSSProperties = {
    display: "flex",
    width: `${Math.max(Math.min(logoScale, 1), 0.1) * 100}%`,
    height: `${Math.max(Math.min(logoScale, 1), 0.1) * 100}%`,
    alignItems: "center",
    justifyContent: "center",
    padding: inset,
  };

  return (
    <div style={frameStyle}>
      <div
        style={{
          ...logoStyle,
          backgroundImage: `url(${logoDataUrl})`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "contain",
        }}
      />
    </div>
  );
}
