import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { parseAndValidateBody, ValidationError } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logInfo, logValidationFailure } from "@/lib/logger";
import { shootingRangeFormSchema } from "@/lib/validation-schema";

const ROUTE = "/api/admin/ranges";

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
}, { route: ROUTE, method: "GET" });

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

  const body = await parseAndValidateBody<CreateRangeBody>(request, createRangeSchema, { route: ROUTE, method: "POST" });

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
    logValidationFailure(ROUTE, "POST", errors);
    throw new ValidationError(errors, { fieldErrors });
  }

  const { name, street, postalCode, city, latitude, longitude } = result.data;

  // Das Koordinaten-Schema garantiert parseFloat-taugliche Werte im gültigen Bereich.
  const parsedLatitude = parseFloat(latitude);
  const parsedLongitude = parseFloat(longitude);

  const existing = await prisma.shootingRange.findUnique({
    where: { name },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Ein Standort mit diesem Namen existiert bereits" },
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
}, { route: ROUTE, method: "POST" });
