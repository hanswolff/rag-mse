import { NextResponse } from "next/server";
import { readAusschreibungFile } from "./ausschreibung-storage";
import { logResourceNotFound } from "./logger";
import { getPublicCacheHeaders } from "./api-error-handler";

export type DispositionType = "inline" | "attachment";

export async function serveAusschreibungFile(options: {
  ausschreibung: {
    id: string;
    storedFileName: string;
    mimeType: string;
    originalFileName: string;
  };
  disposition: DispositionType;
  route: string;
  method: string;
}): Promise<NextResponse> {
  const { ausschreibung, disposition, route, method } = options;

  let content: Buffer;
  try {
    content = await readAusschreibungFile(ausschreibung.storedFileName);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      logResourceNotFound("ausschreibungFile", ausschreibung.storedFileName, route, method, {
        ausschreibungId: ausschreibung.id,
      });
      return NextResponse.json({ error: "Ausschreibung nicht gefunden" }, { status: 404 });
    }
    throw error;
  }

  const body = new Uint8Array(content);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": ausschreibung.mimeType,
      "Content-Length": `${body.byteLength}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(ausschreibung.originalFileName)}`,
      ...getPublicCacheHeaders(60, 300),
    },
  });
}
