import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-utils";
import { normalizeDirectoryId } from "@/lib/document-validation";
import {
  parsePageNumber,
  parsePageSize,
  parseSortField,
  parseSortDirection,
} from "@/lib/document-query";
import { DocumentArea } from "@prisma/client";

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  await requireMember();

  const { searchParams } = new URL(request.url);
  const requestedPage = parsePageNumber(searchParams.get("page"));
  const limit = parsePageSize(searchParams.get("limit"));
  const query = (searchParams.get("q") || "").trim();
  const directoryParam = (searchParams.get("directory") || "").trim();
  const sortBy = parseSortField(searchParams.get("sortBy"));
  const sortDir = parseSortDirection(searchParams.get("sortDir"));

  const where: {
    area: DocumentArea;
    displayName?: { contains: string };
    directoryId?: string | null;
  } = {
    area: DocumentArea.MEMBER,
  };

  if (query) {
    where.displayName = { contains: query };
  }

  if (directoryParam === "root") {
    if (!query) {
      where.directoryId = null;
    }
  } else {
    const normalizedDirectoryId = normalizeDirectoryId(directoryParam);
    if (normalizedDirectoryId) {
      where.directoryId = normalizedDirectoryId;
    }
  }

  const total = await prisma.document.count({ where });
  const pages = Math.ceil(total / limit);
  const page = pages > 0 ? Math.min(requestedPage, pages) : 1;
  const skip = (page - 1) * limit;

  const documents = await prisma.document.findMany({
    where,
    orderBy: [{ [sortBy]: sortDir }, { id: "desc" }],
    skip,
    take: limit,
    include: {
      directory: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({
    documents: documents.map((document) => ({
      id: document.id,
      displayName: document.displayName,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      documentDate: document.documentDate.toISOString(),
      directoryId: document.directoryId,
      directory: document.directory,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    })),
    pagination: {
      total,
      page,
      limit,
      pages,
    },
  });
}, { route: "/api/member/documents", method: "GET" });
