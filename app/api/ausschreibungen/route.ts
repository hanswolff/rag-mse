import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrorHandling, getAuthNoCacheHeaders, getPublicCacheHeaders } from "@/lib/api-error-handler";
import { splitAndSortAusschreibungen } from "@/lib/ausschreibung-validation";
import { getVisibilityFilter } from "@/lib/visibility";
import { getCurrentUser } from "@/lib/auth-utils";

export const GET = withApiErrorHandling(async () => {
  const user = await getCurrentUser();

  const ausschreibungen = await prisma.ausschreibung.findMany({
    where: getVisibilityFilter(Boolean(user)),
    orderBy: { expiresAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      expiresAt: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      visibility: true,
      createdAt: true,
    },
  });

  const { current, historical } = splitAndSortAusschreibungen(ausschreibungen);

  return NextResponse.json({ current, historical }, { headers: user ? getAuthNoCacheHeaders() : getPublicCacheHeaders() });
}, { route: "/api/ausschreibungen", method: "GET" });
