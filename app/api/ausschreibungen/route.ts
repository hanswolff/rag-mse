import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrorHandling, getPublicCacheHeaders } from "@/lib/api-utils";
import { splitAndSortAusschreibungen } from "@/lib/ausschreibung-validation";

export const GET = withApiErrorHandling(async () => {
  const ausschreibungen = await prisma.ausschreibung.findMany({
    orderBy: { expiresAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      expiresAt: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  const { current, historical } = splitAndSortAusschreibungen(ausschreibungen);

  return NextResponse.json({ current, historical }, { headers: getPublicCacheHeaders() });
}, { route: "/api/ausschreibungen", method: "GET" });
