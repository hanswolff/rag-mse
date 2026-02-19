/**
 * Utility for mapping server error messages to specific form fields.
 * This centralizes the pattern of parsing generic error messages to identify affected fields.
 */

/**
 * Maps a general error message to specific field errors based on keyword matching.
 *
 * @param message - The error message from the server
 * @param fieldKeywords - Object mapping field names to arrays of German keywords that identify them
 * @returns Object mapping field names to the error message, or empty object if no match
 *
 * @example
 * const errors = mapServerErrorToField("Name ist erforderlich", {
 *   name: ["Name"],
 *   email: ["E-Mail"],
 *   phone: ["Telefon"],
 * });
 * // Returns: { name: "Name ist erforderlich" }
 */
export function mapServerErrorToField(
  message: string,
  fieldKeywords: Record<string, string[]>
): Record<string, string> {
  if (!message) return {};

  for (const [field, keywords] of Object.entries(fieldKeywords)) {
    if (keywords.some((keyword) => message.includes(keyword))) {
      return { [field]: message };
    }
  }

  return {};
}

/**
 * Maps a general error message to multiple field errors.
 * Use this when a single message might apply to multiple fields.
 *
 * @param message - The error message from the server
 * @param fieldKeywords - Object mapping field names to arrays of German keywords
 * @returns Object mapping all matching field names to the error message
 */
export function mapServerErrorToFields(
  message: string,
  fieldKeywords: Record<string, string[]>
): Record<string, string> {
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
  description: ["Beschreibung"],
  latitude: ["Breitengrad"],
  longitude: ["Längengrad"],
  type: ["Typ"],
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
};
