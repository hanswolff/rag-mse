import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/auth-utils";
import { withApiErrorHandling } from "@/lib/api-utils";
import { DocumentArea } from "@prisma/client";

export const GET = withApiErrorHandling(async () => {
  await requireMember();

  const [directories, rootCount] = await Promise.all([
    prisma.documentDirectory.findMany({
      where: { area: DocumentArea.MEMBER },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: {
        _count: {
          select: {
            documents: true,
          },
        },
      },
    }),
    prisma.document.count({ where: { directoryId: null, area: DocumentArea.MEMBER } }),
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
}, { route: "/api/member/document-directories", method: "GET" });
