import type { Absence } from "@prisma/client";
import { failValidation, parseCompleteJsonBody } from "@/lib/request-body-parser";
import { absenceFormSchema, periodFromStorage, periodToStorage, type StoredPeriod } from "@/lib/validation-schema";
import { zodToValidationResult } from "@/lib/validation-context";
import type { AbsenceItem } from "@/types";

interface AbsenceRequestBody {
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string | null;
  timeTo: string | null;
  reason: string | null;
  userId?: string;
}

const optionalText = { type: "string" as const, nullable: true };

const BODY_SCHEMA = {
  startDate: { type: "string" as const },
  endDate: { type: "string" as const },
  allDay: { type: "boolean" as const },
  timeFrom: optionalText,
  timeTo: optionalText,
  reason: optionalText,
  userId: { type: "string" as const, optional: true },
};

export type AbsenceData = StoredPeriod & { reason: string | null };

export interface AbsenceRequest {
  data: AbsenceData;
  userId?: string;
}

export async function parseAbsenceRequest(
  request: Request,
  routeInfo: { route: string; method: string }
): Promise<AbsenceRequest> {
  const body = await parseCompleteJsonBody<AbsenceRequestBody>(request, BODY_SCHEMA, routeInfo);

  const result = absenceFormSchema.safeParse({
    startDate: body.startDate,
    endDate: body.endDate,
    allDay: body.allDay,
    timeFrom: body.timeFrom ?? "",
    timeTo: body.timeTo ?? "",
    reason: body.reason ?? "",
  });

  if (!result.success) {
    const validation = zodToValidationResult(result);
    failValidation(routeInfo, validation.errors, validation.fieldErrors ?? []);
  }

  return {
    data: { ...periodToStorage(result.data), reason: result.data.reason || null },
    userId: body.userId,
  };
}

export function serializeAbsence(absence: Absence): AbsenceItem {
  return {
    id: absence.id,
    ...periodFromStorage(absence),
    reason: absence.reason,
    createdAt: absence.createdAt.toISOString(),
    updatedAt: absence.updatedAt.toISOString(),
  };
}
