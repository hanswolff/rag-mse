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

export function redactSensitiveLinkTokens(content: string): string {
  return content.replace(SENSITIVE_LINK_PATTERN, "$1***REDACTED***");
}
