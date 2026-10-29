import { z } from "zod";
import { EXTERNAL_EVENT_KIND_ERROR, parseExternalEventKind } from "../external-event-kind";
import { getVisibilityErrorMessage, parseVisibility } from "../visibility";
import type { FieldValidationConfig } from "./field-config";
import { MAX_EVENT_TITLE_LENGTH } from "./event";
import {
  addPeriodIssues,
  periodEndDateSchema,
  periodShape,
  periodStartDateSchema,
  periodTimeFromSchema,
  periodTimeToSchema,
} from "./period";

export const MAX_EXTERNAL_EVENT_LOCATION_LENGTH = 200;
export const MAX_EXTERNAL_EVENT_DESCRIPTION_LENGTH = 4000;
export const MAX_EXTERNAL_EVENT_URL_LENGTH = 2000;

export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const externalEventTitleSchema = z
  .string()
  .trim()
  .min(1, "Titel ist erforderlich")
  .max(MAX_EVENT_TITLE_LENGTH, `Titel darf maximal ${MAX_EVENT_TITLE_LENGTH} Zeichen haben`);

const externalEventLocationSchema = z
  .string()
  .trim()
  .max(MAX_EXTERNAL_EVENT_LOCATION_LENGTH, `Ort darf maximal ${MAX_EXTERNAL_EVENT_LOCATION_LENGTH} Zeichen haben`);

const externalEventDescriptionSchema = z
  .string()
  .trim()
  .max(
    MAX_EXTERNAL_EVENT_DESCRIPTION_LENGTH,
    `Beschreibung darf maximal ${MAX_EXTERNAL_EVENT_DESCRIPTION_LENGTH} Zeichen haben`
  );

const externalEventUrlSchema = z
  .string()
  .trim()
  .max(MAX_EXTERNAL_EVENT_URL_LENGTH, `Link darf maximal ${MAX_EXTERNAL_EVENT_URL_LENGTH} Zeichen haben`)
  .refine((value) => !value || isHttpUrl(value), {
    message: "Link muss mit http:// oder https:// beginnen",
  });

const externalEventKindSchema = z
  .string()
  .trim()
  .refine((value) => !value || parseExternalEventKind(value) !== undefined, {
    message: EXTERNAL_EVENT_KIND_ERROR,
  });

const externalEventVisibilitySchema = z
  .string()
  .refine((value) => parseVisibility(value) !== undefined, {
    message: getVisibilityErrorMessage("Sichtbarkeitsstufe"),
  });

export const externalEventFormSchema = z
  .object({
    title: externalEventTitleSchema,
    ...periodShape,
    location: externalEventLocationSchema,
    description: externalEventDescriptionSchema,
    url: externalEventUrlSchema,
    kind: externalEventKindSchema,
    visibility: externalEventVisibilitySchema,
    ausschreibungId: z.string().trim(),
  })
  .superRefine(addPeriodIssues);

export type ExternalEventFormInput = z.input<typeof externalEventFormSchema>;

export const externalEventValidationConfig: Record<string, FieldValidationConfig> = {
  title: { zod: externalEventTitleSchema },
  startDate: { zod: periodStartDateSchema },
  endDate: { zod: periodEndDateSchema },
  timeFrom: { zod: periodTimeFromSchema },
  timeTo: { zod: periodTimeToSchema },
  location: { zod: externalEventLocationSchema },
  description: { zod: externalEventDescriptionSchema },
  url: { zod: externalEventUrlSchema },
};
