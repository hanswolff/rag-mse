import { z } from "zod";
import { isEventType } from "../event-types";
import {
  MAX_EVENT_DESCRIPTION_BYTES,
  hasEventDescriptionContent,
  isEventDescriptionWithinLimit,
} from "../event-description";
import { isTimeRangeValid } from "../dates";
import type { FieldValidationConfig } from "./field-config";
import {
  optionalLatitudeSchema,
  optionalLongitudeSchema,
  requiredDateSchema,
  timeRegex,
} from "./core";

const requiredTimeSchema = (requiredMessage: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .regex(timeRegex, "Ungültiges Zeitformat");

const requiredLocationSchema = z
  .string()
  .trim()
  .min(1, "Ort ist erforderlich")
  .max(200, "Ort darf maximal 200 Zeichen haben");

const requiredDescriptionSchema = z
  .string()
  .superRefine((value, ctx) => {
    if (!hasEventDescriptionContent(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Beschreibung ist erforderlich" });
      return;
    }

    if (!isEventDescriptionWithinLimit(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Beschreibung darf maximal ${MAX_EVENT_DESCRIPTION_BYTES.toLocaleString("de-DE")} Bytes haben`,
      });
    }
  });

export const MAX_EVENT_TITLE_LENGTH = 200;

const optionalEventTitleSchema = z
  .string()
  .trim()
  .max(MAX_EVENT_TITLE_LENGTH, `Titel darf maximal ${MAX_EVENT_TITLE_LENGTH} Zeichen haben`);

export const MAX_EVENT_COST_LENGTH = 100;

const optionalEventCostSchema = z
  .string()
  .trim()
  .max(MAX_EVENT_COST_LENGTH, `Kosten dürfen maximal ${MAX_EVENT_COST_LENGTH} Zeichen haben`);

export const EVENT_CAPACITY_ERROR = "Plätze müssen eine positive ganze Zahl sein";

const optionalEventCapacitySchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    if (!/^\d+$/.test(value)) return false;
    return Number.parseInt(value, 10) > 0;
  }, { message: EVENT_CAPACITY_ERROR });

export const validateLocation = (location: string): boolean => {
  if (typeof location !== "string") return false;
  return requiredLocationSchema.safeParse(location).success;
};

export const validateDescription = (description: string): boolean => {
  if (typeof description !== "string") return false;
  return requiredDescriptionSchema.safeParse(description).success;
};

export const validateEventTitle = (title: string): boolean => {
  if (typeof title !== "string") return false;
  return optionalEventTitleSchema.safeParse(title).success;
};

export const validateEventCost = (cost: string): boolean => {
  if (typeof cost !== "string") return false;
  return optionalEventCostSchema.safeParse(cost).success;
};

export const validateEventCapacity = (capacity: number | string): boolean => {
  if (typeof capacity === "number") {
    return Number.isInteger(capacity) && capacity > 0;
  }
  if (typeof capacity !== "string") return false;
  return optionalEventCapacitySchema.safeParse(capacity).success;
};

// Event type validation
// `unknown`, weil der Wert aus einem JSON-Body kommt: `type.trim()` warf bei
// einem Objekt eine TypeError und die Route antwortete mit 500 statt 400.
export const validateEventType = (type: unknown): boolean => {
  if (type === null || type === undefined) return true;
  if (typeof type !== "string") return false;
  if (type.trim() === "") return true;
  return isEventType(type);
};

export const eventFormSchema = z
  .object({
    date: requiredDateSchema,
    timeFrom: requiredTimeSchema("Uhrzeit von ist erforderlich"),
    timeTo: requiredTimeSchema("Uhrzeit bis ist erforderlich"),
    location: requiredLocationSchema,
    description: requiredDescriptionSchema,
    latitude: optionalLatitudeSchema,
    longitude: optionalLongitudeSchema,
  })
  .refine(
    (data) => {
      if (data.timeFrom && data.timeTo) {
        return isTimeRangeValid(data.timeFrom, data.timeTo);
      }
      return true;
    },
    {
      message: "Uhrzeit bis muss nach Uhrzeit von liegen",
      path: ["timeTo"],
    }
  );

export const eventValidationConfig: Record<string, FieldValidationConfig> = {
  date: { zod: requiredDateSchema },
  timeFrom: { zod: requiredTimeSchema("Uhrzeit von ist erforderlich") },
  timeTo: { zod: requiredTimeSchema("Uhrzeit bis ist erforderlich") },
  location: { zod: requiredLocationSchema },
  title: { zod: optionalEventTitleSchema },
  cost: { zod: optionalEventCostSchema },
  capacity: { zod: optionalEventCapacitySchema },
  description: { zod: requiredDescriptionSchema },
  latitude: { zod: optionalLatitudeSchema },
  longitude: { zod: optionalLongitudeSchema },
};
