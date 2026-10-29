import { externalEventFormSchema, type ExternalEventFormInput } from "@/lib/validation-schema";
import { EXTERNAL_EVENT_KIND_LABELS, EXTERNAL_EVENT_KINDS } from "@/lib/external-event-kind";

const valid: ExternalEventFormInput = {
  title: "RDL Schießausbildung",
  startDate: "2026-11-06",
  endDate: "2026-11-08",
  allDay: true,
  timeFrom: "",
  timeTo: "",
  location: "",
  description: "",
  url: "",
  kind: "",
  visibility: "MEMBER",
  ausschreibungId: "",
};

function errorsOf(input: Partial<ExternalEventFormInput>): Record<string, string> {
  const result = externalEventFormSchema.safeParse({ ...valid, ...input });
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe("Fremdtermin-Validierung", () => {
  it("akzeptiert einen minimalen Fremdtermin", () => {
    expect(errorsOf({})).toEqual({});
  });

  it("verlangt einen Titel mit höchstens 200 Zeichen", () => {
    expect(errorsOf({ title: "   " })).toEqual({ title: "Titel ist erforderlich" });
    expect(errorsOf({ title: "x".repeat(201) })).toEqual({ title: "Titel darf maximal 200 Zeichen haben" });
  });

  it("begrenzt Ort und Beschreibung", () => {
    expect(errorsOf({ location: "x".repeat(201), description: "x".repeat(4001) })).toEqual({
      location: "Ort darf maximal 200 Zeichen haben",
      description: "Beschreibung darf maximal 4000 Zeichen haben",
    });
  });

  it.each(["https://example.org/rdl", "http://example.org"])("akzeptiert den Link %s", (url) => {
    expect(errorsOf({ url })).toEqual({});
  });

  it.each(["javascript:alert(1)", "ftp://example.org", "example.org"])("lehnt den Link %s ab", (url) => {
    expect(errorsOf({ url })).toEqual({ url: "Link muss mit http:// oder https:// beginnen" });
  });

  it("akzeptiert jede Fremdtermin-Art und lehnt unbekannte mit den Beschriftungen ab", () => {
    for (const kind of EXTERNAL_EVENT_KINDS) {
      expect(errorsOf({ kind })).toEqual({});
    }
    expect(errorsOf({ kind: "PARTY" })).toEqual({
      kind: "Art muss RDL, RK-Veranstaltung, Wettkampf oder Sonstiges sein",
    });
  });

  it("führt die deutschen Beschriftungen der Arten zentral", () => {
    expect(EXTERNAL_EVENT_KIND_LABELS).toEqual({
      RDL: "RDL",
      RK_EVENT: "RK-Veranstaltung",
      COMPETITION: "Wettkampf",
      OTHER: "Sonstiges",
    });
  });

  it("lehnt eine unbekannte Sichtbarkeitsstufe mit den Beschriftungen ab", () => {
    expect(errorsOf({ visibility: "SECRET" }).visibility).toContain("Nur für Mitglieder (MEMBER)");
  });

  it("wendet die Zeitraum-Regeln an", () => {
    expect(errorsOf({ endDate: "2026-11-01" })).toEqual({ endDate: "„Bis“ darf nicht vor „Von“ liegen" });
    expect(errorsOf({ allDay: false })).toEqual({
      timeFrom: "Uhrzeit von ist erforderlich, wenn nicht ganztägig",
      timeTo: "Uhrzeit bis ist erforderlich, wenn nicht ganztägig",
    });
  });
});
