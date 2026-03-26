import { PollType } from "@prisma/client";
import type { ValidationResult } from "./validation-context";

export type { ValidationResult } from "./validation-context";

export const POLL_TITLE_MAX_LENGTH = 200;
export const POLL_DESCRIPTION_MAX_LENGTH = 2000;
export const POLL_OPTION_TEXT_MAX_LENGTH = 200;
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 20;

export const VALID_POLL_TYPES: PollType[] = ["TERMIN", "SONSTIGES"];

export interface PollOptionInput {
  id?: string;
  text: string;
  position: number;
}

export interface CreatePollRequest {
  title: string;
  description?: string;
  type: string;
  multipleChoice?: boolean;
  eventId?: string;
  options: PollOptionInput[];
}

export interface UpdatePollRequest {
  title?: string;
  description?: string;
  multipleChoice?: boolean;
  options?: PollOptionInput[];
}


function isValidPollType(type: string): type is PollType {
  return VALID_POLL_TYPES.includes(type as PollType);
}

function validateTitle(title: unknown): string[] {
  if (!title || typeof title !== "string") return ["Titel ist erforderlich"];
  const trimmed = title.trim();
  if (trimmed.length === 0) return ["Titel darf nicht leer sein"];
  if (trimmed.length > POLL_TITLE_MAX_LENGTH) {
    return [`Titel darf maximal ${POLL_TITLE_MAX_LENGTH} Zeichen lang sein`];
  }
  return [];
}

function validateDescription(description: unknown): string[] {
  if (description === undefined || description === null || description === "") return [];
  if (typeof description !== "string") return ["Beschreibung muss ein Text sein"];
  if (description.length > POLL_DESCRIPTION_MAX_LENGTH) {
    return [`Beschreibung darf maximal ${POLL_DESCRIPTION_MAX_LENGTH} Zeichen lang sein`];
  }
  return [];
}

function validateOptions(options: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(options)) {
    return ["Optionen müssen als Liste angegeben werden"];
  }
  if (options.length < POLL_OPTIONS_MIN) {
    errors.push(`Mindestens ${POLL_OPTIONS_MIN} Optionen sind erforderlich`);
  }
  if (options.length > POLL_OPTIONS_MAX) {
    errors.push(`Maximal ${POLL_OPTIONS_MAX} Optionen sind erlaubt`);
  }
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (!opt || typeof opt !== "object") {
      errors.push(`Option ${i + 1}: ungültiges Format`);
      continue;
    }
    const { text } = opt as { text: unknown };
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      errors.push(`Option ${i + 1}: Text ist erforderlich`);
    } else if (text.trim().length > POLL_OPTION_TEXT_MAX_LENGTH) {
      errors.push(`Option ${i + 1}: Text darf maximal ${POLL_OPTION_TEXT_MAX_LENGTH} Zeichen lang sein`);
    }
  }
  return errors;
}

export function validateCreatePollRequest(request: CreatePollRequest): ValidationResult {
  const errors: string[] = [];

  errors.push(...validateTitle(request.title));
  errors.push(...validateDescription(request.description));

  if (!request.type || typeof request.type !== "string") {
    errors.push("Typ ist erforderlich");
  } else if (!isValidPollType(request.type)) {
    errors.push("Ungültiger Typ (muss Termin oder Sonstiges sein)");
  } else {
    if (request.type === "TERMIN" && !request.eventId) {
      errors.push("Termin-ID ist erforderlich für den Typ Termin");
    }
    if (request.type === "SONSTIGES" && request.eventId) {
      errors.push("Termin-ID darf beim Typ Sonstiges nicht angegeben werden");
    }
  }

  if (request.multipleChoice !== undefined && typeof request.multipleChoice !== "boolean") {
    errors.push("Mehrfachauswahl muss true oder false sein");
  }

  errors.push(...validateOptions(request.options));

  return { isValid: errors.length === 0, errors };
}

export function validateUpdatePollRequest(request: UpdatePollRequest): ValidationResult {
  const errors: string[] = [];

  if (request.title !== undefined) {
    errors.push(...validateTitle(request.title));
  }

  if (request.description !== undefined) {
    errors.push(...validateDescription(request.description));
  }

  if (request.multipleChoice !== undefined && typeof request.multipleChoice !== "boolean") {
    errors.push("Mehrfachauswahl muss true oder false sein");
  }

  if (request.options !== undefined) {
    errors.push(...validateOptions(request.options));
  }

  return { isValid: errors.length === 0, errors };
}

export function validateVoteRequest(optionIds: unknown, multipleChoice: boolean): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(optionIds)) {
    return { isValid: false, errors: ["optionIds muss eine Liste sein"] };
  }

  if (optionIds.length === 0) {
    errors.push("Mindestens eine Option muss gewählt werden");
  }

  if (!multipleChoice && optionIds.length > 1) {
    errors.push("Bei Einzelauswahl darf nur eine Option gewählt werden");
  }

  for (const id of optionIds) {
    if (typeof id !== "string" || id.trim().length === 0) {
      errors.push("Ungültige Options-ID");
      break;
    }
  }

  if (Array.isArray(optionIds)) {
    const normalizedIds = optionIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim());
    if (new Set(normalizedIds).size !== normalizedIds.length) {
      errors.push("Jede Option darf nur einmal gewählt werden");
    }
  }

  return { isValid: errors.length === 0, errors };
}
