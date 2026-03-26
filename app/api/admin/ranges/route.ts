import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import {
  parseJsonBody,
  withApiErrorHandling,
  validateRequestBody,
  validateCsrfHeaders,
} from "@/lib/api-utils";
import { logInfo, logValidationFailure } from "@/lib/logger";
import { shootingRangeFormSchema } from "@/lib/validation-schema";

const createRangeSchema = {
  name: { type: "string" as const },
  street: { type: "string" as const, optional: true },
  postalCode: { type: "string" as const, optional: true },
  city: { type: "string" as const, optional: true },
  latitude: { type: "string" as const },
  longitude: { type: "string" as const },
} as const;

export const GET = withApiErrorHandling(async () => {
  await requireAdmin("read");

  const ranges = await prisma.shootingRange.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ ranges });
}, { route: "/api/admin/ranges", method: "GET" });

interface CreateRangeBody {
  name: string;
  street?: string;
  postalCode?: string;
  city?: string;
  latitude: string;
  longitude: string;
}

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const body = await parseJsonBody<CreateRangeBody>(request);

  const bodyValidation = validateRequestBody(body, createRangeSchema, { route: "/api/admin/ranges", method: "POST" });
  if (!bodyValidation.isValid) {
    return NextResponse.json({ error: bodyValidation.errors.join(". ") }, { status: 400 });
  }

  const result = shootingRangeFormSchema.safeParse({
    name: body.name ?? "",
    street: body.street ?? "",
    postalCode: body.postalCode ?? "",
    city: body.city ?? "",
    latitude: body.latitude ?? "",
    longitude: body.longitude ?? "",
  });

  if (!result.success) {
    const errors = result.error.issues.map((e) => e.message);
    const fieldErrors = result.error.issues
      .filter((e) => e.path.length > 0)
      .map((e) => ({ field: String(e.path[0]), message: e.message }));
    logValidationFailure("/api/admin/ranges", "POST", errors);
    return NextResponse.json({ error: errors.join(". "), fieldErrors }, { status: 400 });
  }

  const { name, street, postalCode, city, latitude, longitude } = result.data;

  const parsedLatitude = parseFloat(latitude);
  const parsedLongitude = parseFloat(longitude);
  if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
    const fieldErrors = [
      ...(Number.isNaN(parsedLatitude) ? [{ field: "latitude", message: "Ungültige Koordinaten" }] : []),
      ...(Number.isNaN(parsedLongitude) ? [{ field: "longitude", message: "Ungültige Koordinaten" }] : []),
    ];
    return NextResponse.json({ error: "Ungültige Koordinaten", fieldErrors }, { status: 400 });
  }

  const existing = await prisma.shootingRange.findUnique({
    where: { name },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Ein Schießstand mit diesem Namen existiert bereits" },
      { status: 409 }
    );
  }

  const range = await prisma.shootingRange.create({
    data: {
      name,
      street: street || null,
      postalCode: postalCode || null,
      city: city || null,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
    },
  });

  logInfo("shooting_range_created", "Shooting range created", {
    rangeId: range.id,
    name: range.name,
  });

  return NextResponse.json(range, { status: 201 });
}, { route: "/api/admin/ranges", method: "POST" });
