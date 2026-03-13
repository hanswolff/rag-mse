import { NextResponse } from "next/server";
import { readDocumentFile } from "./document-storage";
import { logResourceNotFound } from "./logger";

export type DispositionType = "inline" | "attachment";

export async function serveDocumentFile(options: {
  document: {
    id: string;
    storedFileName: string;
    mimeType: string;
    originalFileName: string;
  };
  disposition: DispositionType;
  route: string;
  method: string;
}): Promise<NextResponse> {
  const { document, disposition, route, method } = options;

  let content: Buffer;
  try {
    content = await readDocumentFile(document.storedFileName);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      logResourceNotFound("documentFile", document.storedFileName, route, method, {
        documentId: document.id,
      });
      return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
    }
    throw error;
  }

  const body = new Uint8Array(content);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": `${body.byteLength}`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(document.originalFileName)}`,
    },
  });
}
