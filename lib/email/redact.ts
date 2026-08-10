const SENSITIVE_LINK_PATHS = [
  "passwort-zuruecksetzen",
  "einladung",
  "anmeldung",
  "benachrichtigungen/abmelden",
];

const SENSITIVE_LINK_PATTERN = new RegExp(
  `(/(?:${SENSITIVE_LINK_PATHS.join("|")})/)([A-Za-z0-9_-]+)`,
  "g",
);

const TOKEN_PLACEHOLDER_PREFIX = "***TOKEN_";
const TOKEN_PLACEHOLDER_SUFFIX = "***";

export function redactSensitiveLinkTokens(content: string): string {
  return content.replace(SENSITIVE_LINK_PATTERN, "$1***REDACTED***");
}

function placeholderFor(index: number): string {
  return `${TOKEN_PLACEHOLDER_PREFIX}${index}${TOKEN_PLACEHOLDER_SUFFIX}`;
}

/**
 * Ersetzt Einmal-Token in Links durch Platzhalter und gibt die Token separat zurück.
 * Der Postausgang speichert nur den platzhalterisierten Text; die Token werden in einem
 * eigenen Feld gehalten und nach dem Versand gelöscht, damit ein DB-Abzug keine
 * funktionierenden Passwort-Reset-/Einladungslinks enthält.
 */
export function extractSensitiveLinkTokens(parts: string[]): { redacted: string[]; tokens: string[] } {
  const tokens: string[] = [];
  const redacted = parts.map((part) =>
    part.replace(SENSITIVE_LINK_PATTERN, (_match, prefix: string, token: string) => {
      let index = tokens.indexOf(token);
      if (index === -1) {
        index = tokens.length;
        tokens.push(token);
      }
      return `${prefix}${placeholderFor(index)}`;
    })
  );

  return { redacted, tokens };
}

export function restoreSensitiveLinkTokens(content: string, tokens: string[]): string {
  return tokens.reduce(
    (result, token, index) => result.split(placeholderFor(index)).join(token),
    content
  );
}

export function serializeSensitiveTokens(tokens: string[]): string | null {
  return tokens.length > 0 ? JSON.stringify(tokens) : null;
}

export function containsTokenPlaceholders(content: string): boolean {
  return content.includes(TOKEN_PLACEHOLDER_PREFIX);
}

export function parseSensitiveTokens(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}
