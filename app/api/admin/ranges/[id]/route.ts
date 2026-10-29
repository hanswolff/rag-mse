import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { parseAndValidateBody, ValidationError } from "@/lib/request-body-parser";
import { withApiErrorHandling } from "@/lib/api-error-handler";
import { validateCsrfHeaders } from "@/lib/csrf-validator";
import { logInfo, logResourceNotFound, logValidationFailure } from "@/lib/logger";
import { shootingRangeFormSchema } from "@/lib/validation-schema";

const ROUTE = "/api/admin/ranges/[id]";

const updateRangeSchema = {
  name: { type: "string" as const },
  street: { type: "string" as const, optional: true },
  postalCode: { type: "string" as const, optional: true },
  city: { type: "string" as const, optional: true },
  latitude: { type: "string" as const },
  longitude: { type: "string" as const },
} as const;

interface UpdateRangeBody {
  name: string;
  street?: string;
  postalCode?: string;
  city?: string;
  latitude: string;
  longitude: string;
}

export const PUT = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/admin/ranges/[id]">
) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;
  const body = await parseAndValidateBody<UpdateRangeBody>(request, updateRangeSchema, { route: ROUTE, method: "PUT" });

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
    logValidationFailure(ROUTE, "PUT", errors, { rangeId: id });
    throw new ValidationError(errors, { fieldErrors });
  }

  const existing = await prisma.shootingRange.findUnique({ where: { id } });
  if (!existing) {
    logResourceNotFound("shooting_range", id, ROUTE, "PUT");
    return NextResponse.json({ error: "Standort nicht gefunden" }, { status: 404 });
  }

  const { name, street, postalCode, city, latitude, longitude } = result.data;

  // Das Koordinaten-Schema garantiert parseFloat-taugliche Werte im gültigen Bereich.
  const parsedLatitude = parseFloat(latitude);
  const parsedLongitude = parseFloat(longitude);

  if (name !== existing.name) {
    const duplicate = await prisma.shootingRange.findUnique({ where: { name } });
    if (duplicate) {
      return NextResponse.json(
        { error: "Ein Standort mit diesem Namen existiert bereits" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.shootingRange.update({
    where: { id },
    data: {
      name,
      street: street || null,
      postalCode: postalCode || null,
      city: city || null,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
    },
  });

  logInfo("shooting_range_updated", "Shooting range updated", {
    rangeId: updated.id,
    name: updated.name,
  });

  return NextResponse.json(updated);
}, { route: ROUTE, method: "PUT" });

export const DELETE = withApiErrorHandling(async (
  request: NextRequest,
  ctx: RouteContext<"/api/admin/ranges/[id]">
) => {
  validateCsrfHeaders(request);
  await requireAdmin("write");

  const { id } = await ctx.params;

  const existing = await prisma.shootingRange.findUnique({ where: { id } });
  if (!existing) {
    logResourceNotFound("shooting_range", id, ROUTE, "DELETE");
    return NextResponse.json({ error: "Standort nicht gefunden" }, { status: 404 });
  }

  await prisma.shootingRange.delete({ where: { id } });

  logInfo("shooting_range_deleted", "Shooting range deleted", {
    rangeId: existing.id,
    name: existing.name,
  });

  return NextResponse.json({ success: true });
}, { route: ROUTE, method: "DELETE" });
