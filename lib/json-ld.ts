// Serialisiert JSON-LD für die Einbettung in <script type="application/ld+json">.
// JSON.stringify escaped "</script>" nicht — ein Angreifer könnte damit aus dem
// Script-Kontext ausbrechen (Stored XSS). Kritische Zeichen werden deshalb als
// Unicode-Escapes ausgegeben; das Ergebnis bleibt gültiges JSON.
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
