import { VoteType } from "@prisma/client";
import { parseDateAndTime } from "@/lib/date-picker-utils";
import {
  validateDateString,
  validateTimeString as validateTimeFormat,
  validateLocation,
  validateLatitude,
  validateLongitude,
  validateEventType,
} from "./validation-schema";
import {
  MAX_EVENT_DESCRIPTION_BYTES,
  hasEventDescriptionContent,
  isEventDescriptionWithinLimit,
} from "./event-description";
import { createValidationContext } from "./validation-context";
import type { ValidationResult } from "./validation-context";

// Re-export validation functions for backward compatibility with tests
export { validateLocation, validateDescription, validateLatitude, validateLongitude } from "./validation-schema";

// For backward compatibility: alias validateLatitude to validateCoordinate
export function validateCoordinate(coord: string): boolean {
  return validateLatitude(coord);
}

export interface CreateEventRequest {
  date: string;
  timeFrom: string;
  timeTo: string;
  location: string;
  description: string;
  latitude?: string | number;
  longitude?: string | number;
  type?: string;
  visible?: boolean;
}

export interface UpdateEventRequest {
  date?: string;
  timeFrom?: string;
  timeTo?: string;
  location?: string;
  description?: string;
  latitude?: number | string;
  longitude?: number | string;
  type?: string;
  visible?: boolean;
}

export type { ValidationResult } from "./validation-context";

export function validateDateTime(date: string, time: string): boolean {
  if (!date || !time) {
    return false;
  }

  if (!validateDateString(date) || !validateTimeFormat(time)) {
    return false;
  }

  try {
    const dateTime = parseDateAndTime(date, time);
    return !isNaN(dateTime.getTime());
  } catch {
    return false;
  }
}

export function validateTimeString(time: string): boolean {
  return validateTimeFormat(time);
}

export function validateCreateEventRequest(request: CreateEventRequest): ValidationResult {
  const ctx = createValidationContext();
  const { date, timeFrom, timeTo, location, description, latitude, longitude } = request;

  if (!date || typeof date !== "string") {
    ctx.addError("date", "Datum ist erforderlich");
  } else if (!validateDateTime(date, "12:00")) {
    ctx.addError("date", "Ungültiges Datumsformat");
  }

  if (!timeFrom || typeof timeFrom !== "string") {
    ctx.addError("timeFrom", "Uhrzeit von ist erforderlich");
  } else if (!validateTimeFormat(timeFrom)) {
    ctx.addError("timeFrom", "Ungültiges Zeitformat für Uhrzeit von");
  }

  if (!timeTo || typeof timeTo !== "string") {
    ctx.addError("timeTo", "Uhrzeit bis ist erforderlich");
  } else if (!validateTimeFormat(timeTo)) {
    ctx.addError("timeTo", "Ungültiges Zeitformat für Uhrzeit bis");
  }

  if (timeFrom && timeTo && validateTimeFormat(timeFrom) && validateTimeFormat(timeTo)) {
    const [hoursFrom, minutesFrom] = timeFrom.split(":").map(Number);
    const [hoursTo, minutesTo] = timeTo.split(":").map(Number);
    const fromMinutes = hoursFrom * 60 + minutesFrom;
    const toMinutes = hoursTo * 60 + minutesTo;

    if (fromMinutes >= toMinutes) {
      ctx.addError("timeTo", "Uhrzeit bis muss nach Uhrzeit von liegen");
    }
  }

  if (!location || typeof location !== "string") {
    ctx.addError("location", "Ort ist erforderlich");
  } else if (!validateLocation(location)) {
    ctx.addError("location", "Ort darf nicht leer sein");
  }

  if (!description || typeof description !== "string") {
    ctx.addError("description", "Beschreibung ist erforderlich");
  } else if (!hasEventDescriptionContent(description)) {
    ctx.addError("description", "Beschreibung darf nicht leer sein");
  } else if (!isEventDescriptionWithinLimit(description)) {
    ctx.addError("description", `Beschreibung darf maximal ${MAX_EVENT_DESCRIPTION_BYTES.toLocaleString("de-DE")} Bytes haben`);
  }

  if (latitude !== undefined && latitude !== "" && !validateLatitude(String(latitude))) {
    ctx.addError("latitude", "Ungültiger Breitengrad (muss zwischen -90 und 90 liegen)");
  }

  if (longitude !== undefined && longitude !== "" && !validateLongitude(String(longitude))) {
    ctx.addError("longitude", "Ungültiger Längengrad (muss zwischen -180 und 180 liegen)");
  }

  if (request.type !== undefined && !validateEventType(request.type)) {
    ctx.addError("type", "Ungültiger Typ (muss Training, Wettkampf oder leer sein)");
  }

  if (request.visible !== undefined && typeof request.visible !== "boolean") {
    ctx.errors.push("Ungültiger Wert für Sichtbarkeit");
  }

  return ctx.toResult();
}

export function validateUpdateEventRequest(request: UpdateEventRequest): ValidationResult {
  const ctx = createValidationContext();
  const { date, timeFrom, timeTo, location, description } = request;

  if (date !== undefined) {
    if (date === "" || !validateDateTime(date, "12:00")) {
      ctx.addError("date", "Ungültiges Datumsformat");
    }
  }

  if (timeFrom !== undefined) {
    if (timeFrom === "" || !validateTimeFormat(timeFrom)) {
      ctx.addError("timeFrom", "Ungültiges Zeitformat für Uhrzeit von");
    }
  }

  if (timeTo !== undefined) {
    if (timeTo === "" || !validateTimeFormat(timeTo)) {
      ctx.addError("timeTo", "Ungültiges Zeitformat für Uhrzeit bis");
    }
  }

  if (location !== undefined) {
    if (location === "" || !validateLocation(location)) {
      ctx.addError("location", "Ort darf nicht leer sein");
    }
  }

  if (description !== undefined) {
    if (typeof description !== "string") {
      ctx.addError("description", "Beschreibung muss ein Text sein");
    } else if (!hasEventDescriptionContent(description)) {
      ctx.addError("description", "Beschreibung darf nicht leer sein");
    } else if (!isEventDescriptionWithinLimit(description)) {
      ctx.addError("description", `Beschreibung darf maximal ${MAX_EVENT_DESCRIPTION_BYTES.toLocaleString("de-DE")} Bytes haben`);
    }
  }

  if (request.latitude !== undefined && request.latitude !== "" && !validateLatitude(String(request.latitude))) {
    ctx.addError("latitude", "Ungültiger Breitengrad (muss zwischen -90 und 90 liegen)");
  }

  if (request.longitude !== undefined && request.longitude !== "" && !validateLongitude(String(request.longitude))) {
    ctx.addError("longitude", "Ungültiger Längengrad (muss zwischen -180 und 180 liegen)");
  }

  if (request.type !== undefined && !validateEventType(request.type)) {
    ctx.addError("type", "Ungültiger Typ (muss Training, Wettkampf oder leer sein)");
  }

  if (request.visible !== undefined && typeof request.visible !== "boolean") {
    ctx.errors.push("Ungültiger Wert für Sichtbarkeit");
  }

  if (timeFrom !== undefined && timeTo !== undefined && timeFrom !== "" && timeTo !== "") {
    if (validateTimeFormat(timeFrom) && validateTimeFormat(timeTo)) {
      const [hoursFrom, minutesFrom] = timeFrom.split(":").map(Number);
      const [hoursTo, minutesTo] = timeTo.split(":").map(Number);
      const fromMinutes = hoursFrom * 60 + minutesFrom;
      const toMinutes = hoursTo * 60 + minutesTo;

      if (fromMinutes >= toMinutes) {
        ctx.addError("timeTo", "Uhrzeit bis muss nach Uhrzeit von liegen");
      }
    }
  }

  return ctx.toResult();
}

export function validateVote(vote: string): vote is VoteType {
  return Object.values(VoteType).includes(vote as VoteType);
}
