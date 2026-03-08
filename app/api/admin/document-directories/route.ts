import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { parseJsonBody, validateCsrfHeaders, withApiErrorHandling } from "@/lib/api-utils";
import {
  normalizeDirectoryNameForUniqueness,
  parseAndValidateDocumentDirectoryRequest,
} from "@/lib/document-validation";
import { prisma } from "@/lib/prisma";
import { logValidationFailure } from "@/lib/logger";

export const GET = withApiErrorHandling(async () => {
  await requireAdmin("read");

  const [directories, rootCount] = await Promise.all([
    prisma.documentDirectory.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: {
        _count: {
          select: {
            documents: true,
          },
        },
      },
    }),
    prisma.document.count({ where: { directoryId: null } }),
  ]);

  return NextResponse.json({
    rootCount,
    directories: directories.map((directory) => ({
      id: directory.id,
      name: directory.name,
      documentCount: directory._count.documents,
      createdAt: directory.createdAt.toISOString(),
      updatedAt: directory.updatedAt.toISOString(),
    })),
  });
}, { route: "/api/admin/document-directories", method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const rawBody = await parseJsonBody<unknown>(request);
  const parsed = parseAndValidateDocumentDirectoryRequest(rawBody);

  if (!parsed.isValid) {
    logValidationFailure("/api/admin/document-directories", "POST", parsed.errors);
    return NextResponse.json({ error: parsed.errors.join(". ") }, { status: 400 });
  }

  try {
    const created = await prisma.documentDirectory.create({
      data: {
        name: parsed.data.name,
        nameNormalized: normalizeDirectoryNameForUniqueness(parsed.data.name),
      },
      include: {
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: created.id,
      name: created.name,
      documentCount: created._count.documents,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error: unknown) {
    if (
      error
      && typeof error === "object"
      && "code" in error
      && error.code === "P2002"
    ) {
      return NextResponse.json({ error: "Ein Verzeichnis mit diesem Namen existiert bereits" }, { status: 409 });
    }
    throw error;
  }
}, { route: "/api/admin/document-directories", method: "POST" });
