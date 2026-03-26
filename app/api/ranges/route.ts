import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrorHandling } from "@/lib/api-utils";

export const GET = withApiErrorHandling(async () => {
  const ranges = await prisma.shootingRange.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      street: true,
      postalCode: true,
      city: true,
      latitude: true,
      longitude: true,
    },
  });

  return NextResponse.json({ ranges });
}, { route: "/api/ranges", method: "GET" });
