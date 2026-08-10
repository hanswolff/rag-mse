/**
 * Utility for mapping server error messages to specific form fields.
 * Supports structured field errors (preferred) with keyword-matching fallback.
 */

export interface FieldError {
  field: string;
  message: string;
}

export interface FieldErrorResponse {
  error: string;
  fieldErrors?: FieldError[];
}

export function mapServerErrorToField(
  message: string,
  fieldKeywords: Record<string, string[]>,
  fieldErrors?: FieldError[]
): Record<string, string> {
  if (fieldErrors && fieldErrors.length > 0) {
    const result: Record<string, string> = {};
    for (const fe of fieldErrors) {
      if (fe.field in fieldKeywords) {
        result[fe.field] = fe.message;
      }
    }
    if (Object.keys(result).length > 0) return result;
  }

  if (!message) return {};

  for (const [field, keywords] of Object.entries(fieldKeywords)) {
    if (keywords.some((keyword) => message.includes(keyword))) {
      return { [field]: message };
    }
  }

  return {};
}

export function mapServerErrorToFields(
  message: string,
  fieldKeywords: Record<string, string[]>,
  fieldErrors?: FieldError[]
): Record<string, string> {
  if (fieldErrors && fieldErrors.length > 0) {
    const result: Record<string, string> = {};
    for (const fe of fieldErrors) {
      if (fe.field in fieldKeywords) {
        result[fe.field] = fe.message;
      }
    }
    if (Object.keys(result).length > 0) return result;
  }

  if (!message) return {};

  const errors: Record<string, string> = {};

  for (const [field, keywords] of Object.entries(fieldKeywords)) {
    if (keywords.some((keyword) => message.includes(keyword))) {
      errors[field] = message;
    }
  }

  return errors;
}

// Pre-defined keyword mappings for common forms
export const PROFILE_FIELD_KEYWORDS: Record<string, string[]> = {
  name: ["Name"],
  email: ["E-Mail"],
  address: ["Adresse"],
  phone: ["Telefon"],
  dateOfBirth: ["Geburtsdatum"],
  memberSince: ["Mitglied-seit", "Mitglied seit"],
  rank: ["Dienstgrad"],
  pk: ["PK"],
  reservistsAssociation: ["Reservistenkameradschaft"],
  associationMemberNumber: ["Mitgliedsnummer"],
  role: ["Rolle"],
};

export const EVENT_FIELD_KEYWORDS: Record<string, string[]> = {
  date: ["Datum"],
  timeFrom: ["Uhrzeit von"],
  timeTo: ["Uhrzeit bis"],
  location: ["Ort"],
  title: ["Titel"],
  description: ["Beschreibung"],
  latitude: ["Breitengrad"],
  longitude: ["Längengrad"],
  type: ["Typ"],
  cost: ["Kosten"],
  capacity: ["Plätze"],
};

export const NEWS_FIELD_KEYWORDS: Record<string, string[]> = {
  newsDate: ["Datum"],
  title: ["Titel"],
  content: ["Inhalt"],
};

export const CONTACT_FIELD_KEYWORDS: Record<string, string[]> = {
  name: ["Name"],
  email: ["E-Mail"],
  message: ["Nachricht"],
};

export const DOCUMENT_FIELD_KEYWORDS: Record<string, string[]> = {
  displayName: ["Dokumentenname"],
  documentDate: ["Dokumentdatum"],
  directoryId: ["Verzeichnis", "directoryId"],
};

export const SHOOTING_RANGE_FIELD_KEYWORDS: Record<string, string[]> = {
  name: ["Name"],
  street: ["Straße"],
  postalCode: ["PLZ"],
  city: ["Ort"],
  latitude: ["Breitengrad"],
  longitude: ["Längengrad"],
};
