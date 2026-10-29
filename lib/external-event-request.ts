import type { ExternalEvent, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { failValidation, parseCompleteJsonBody } from "@/lib/request-body-parser";
import { externalEventFormSchema, periodFromStorage, periodToStorage } from "@/lib/validation-schema";
import { zodToValidationResult } from "@/lib/validation-context";
import { parseExternalEventKind } from "@/lib/external-event-kind";
import { parseVisibility } from "@/lib/visibility";
import type { ExternalEventItem } from "@/types";

interface ExternalEventRequestBody {
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string | null;
  timeTo: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  kind: string | null;
  visibility: string;
  ausschreibungId: string | null;
}

const optionalText = { type: "string" as const, nullable: true };

const BODY_SCHEMA = {
  title: { type: "string" as const },
  startDate: { type: "string" as const },
  endDate: { type: "string" as const },
  allDay: { type: "boolean" as const },
  timeFrom: optionalText,
  timeTo: optionalText,
  location: optionalText,
  description: optionalText,
  url: optionalText,
  kind: optionalText,
  visibility: { type: "string" as const },
  ausschreibungId: optionalText,
};

type ExternalEventData = Omit<Prisma.ExternalEventUncheckedCreateInput, "id" | "createdById" | "createdAt" | "updatedAt">;

const AUSSCHREIBUNG_NOT_FOUND = "Ausschreibung nicht gefunden";

export async function parseExternalEventRequest(
  request: Request,
  routeInfo: { route: string; method: string }
): Promise<ExternalEventData> {
  const body = await parseCompleteJsonBody<ExternalEventRequestBody>(request, BODY_SCHEMA, routeInfo);

  const result = externalEventFormSchema.safeParse({
    title: body.title,
    startDate: body.startDate,
    endDate: body.endDate,
    allDay: body.allDay,
    timeFrom: body.timeFrom ?? "",
    timeTo: body.timeTo ?? "",
    location: body.location ?? "",
    description: body.description ?? "",
    url: body.url ?? "",
    kind: body.kind ?? "",
    visibility: body.visibility,
    ausschreibungId: body.ausschreibungId ?? "",
  });

  if (!result.success) {
    const validation = zodToValidationResult(result);
    failValidation(routeInfo, validation.errors, validation.fieldErrors ?? []);
  }

  const data = result.data;
  const ausschreibungId = data.ausschreibungId || null;
  if (ausschreibungId && !(await prisma.ausschreibung.findUnique({ where: { id: ausschreibungId }, select: { id: true } }))) {
    failValidation(routeInfo, [AUSSCHREIBUNG_NOT_FOUND], [
      { field: "ausschreibungId", message: AUSSCHREIBUNG_NOT_FOUND },
    ]);
  }

  return {
    title: data.title,
    ...periodToStorage(data),
    location: data.location || null,
    description: data.description || null,
    url: data.url || null,
    kind: parseExternalEventKind(data.kind) ?? null,
    visibility: parseVisibility(data.visibility),
    ausschreibungId,
  };
}

type ExternalEventWithAusschreibung = ExternalEvent & {
  ausschreibung: { id: string; title: string } | null;
};

export const EXTERNAL_EVENT_INCLUDE = {
  ausschreibung: { select: { id: true, title: true } },
} as const;

export function serializeExternalEvent(event: ExternalEventWithAusschreibung): ExternalEventItem {
  return {
    id: event.id,
    title: event.title,
    ...periodFromStorage(event),
    location: event.location,
    description: event.description,
    url: event.url,
    kind: event.kind,
    visibility: event.visibility,
    ausschreibungId: event.ausschreibungId,
    ausschreibung: event.ausschreibung,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
