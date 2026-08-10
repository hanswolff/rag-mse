// Gemeinsame, bewusst eindeutige Testdaten für Fixtures (Server-Prozess)
// und Spezifikationen (Playwright-Prozess). Keine Laufzeit-Abhängigkeiten.

export const E2E_ADMIN = {
  email: "admin@e2e-test.de",
  password: "E2eAdmin!Passwort2026",
  name: "Anton Admin",
} as const;

export const E2E_MITGLIED = {
  email: "mitglied@e2e-test.de",
  password: "E2eMitglied!Passwort2026",
  name: "Erika Beispiel",
} as const;

export const E2E_TERMIN = {
  title: "E2E Vereinsschießen Güstrow",
  location: "Schützenhaus Güstrow",
  timeFrom: "18:00",
  timeTo: "20:00",
  description: "<p>Übungsschießen für die E2E-Kernsuite.</p>",
} as const;

export const E2E_UMFRAGE = {
  title: "E2E Umfrage Vereinsausflug",
  description: "Wohin soll der nächste Vereinsausflug gehen?",
  optionA: "Müritz-Schifffahrt",
  optionB: "Besuch im Schießkino",
} as const;

export function terminDatumInZukunft(tage = 21): Date {
  const datum = new Date();
  datum.setDate(datum.getDate() + tage);
  datum.setHours(0, 0, 0, 0);
  return datum;
}
