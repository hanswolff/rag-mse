import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logApiError } from "@/lib/api-utils";

export async function GET() {
  try {
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
  } catch (error: unknown) {
    logApiError(error, {
      route: "/api/ranges",
      method: "GET",
      status: 500,
    });
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}
