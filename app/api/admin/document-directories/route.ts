import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { parseJsonBody, ValidationError } from "@/lib/request-body-parser";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import {
  normalizeDirectoryNameForUniqueness,
  parseAndValidateDocumentDirectoryRequest,
  parseDocumentArea,
} from "@/lib/document-validation";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { logValidationFailure } from "@/lib/logger";

const ROUTE = "/api/admin/document-directories";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireAdmin("read");

  const { searchParams } = new URL(request.url);
  const areaRaw = searchParams.get("area");
  const areaFilter = parseDocumentArea(areaRaw);
  if (areaRaw !== null && !areaFilter) {
    return NextResponse.json({ error: "area muss ADMIN oder MEMBER sein" }, { status: 400 });
  }

  const directoryWhere = areaFilter ? { area: areaFilter } : {};
  const documentWhere = areaFilter ? { directoryId: null, area: areaFilter } : { directoryId: null };

  const [directories, rootCount] = await Promise.all([
    prisma.documentDirectory.findMany({
      where: directoryWhere,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: {
        _count: {
          select: {
            documents: true,
          },
        },
      },
    }),
    prisma.document.count({ where: documentWhere }),
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
}, { route: ROUTE, method: "GET" });

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const rawBody = await parseJsonBody<unknown>(request);
  const parsed = parseAndValidateDocumentDirectoryRequest(rawBody);

  if (!parsed.isValid) {
    logValidationFailure(ROUTE, "POST", parsed.errors);
    throw new ValidationError(parsed.errors);
  }

  const area = parsed.data.area ?? "ADMIN";

  try {
    const created = await prisma.documentDirectory.create({
      data: {
        name: parsed.data.name,
        nameNormalized: normalizeDirectoryNameForUniqueness(parsed.data.name),
        area,
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
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Ein Verzeichnis mit diesem Namen existiert bereits" }, { status: 409 });
    }
    throw error;
  }
}, { route: ROUTE, method: "POST" });
