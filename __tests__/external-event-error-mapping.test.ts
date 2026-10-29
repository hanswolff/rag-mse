import { ABSENCE_FIELD_KEYWORDS, EXTERNAL_EVENT_FIELD_KEYWORDS, mapServerErrorToField } from "@/lib/server-error-mapper";
import { PERIOD_END_BEFORE_START_ERROR, PERIOD_TIME_ORDER_ERROR } from "@/lib/validation-schema";

describe.each([
  ["Fremdtermin", EXTERNAL_EVENT_FIELD_KEYWORDS],
  ["Abwesenheit", ABSENCE_FIELD_KEYWORDS],
])("%s-Fehlerzuordnung ohne strukturierte Feldfehler", (_name, keywords) => {
  function fieldOf(message: string): string[] {
    return Object.keys(mapServerErrorToField(message, keywords));
  }

  it("ordnet Reihenfolge-Fehler dem Ende zu, nicht dem Beginn", () => {
    expect(PERIOD_END_BEFORE_START_ERROR).toBe("„Bis“ darf nicht vor „Von“ liegen");
    expect(fieldOf(PERIOD_END_BEFORE_START_ERROR)).toEqual(["endDate"]);
    expect(fieldOf(PERIOD_TIME_ORDER_ERROR)).toEqual(["timeTo"]);
  });

  it("ordnet Einzelfeld-Fehler ihrem Feld zu, ohne Uhrzeiten mit Datumsfeldern zu verwechseln", () => {
    expect(fieldOf("Von ist erforderlich")).toEqual(["startDate"]);
    expect(fieldOf("Bis ist ungültig")).toEqual(["endDate"]);
    expect(fieldOf("Uhrzeit von ist erforderlich, wenn nicht ganztägig")).toEqual(["timeFrom"]);
    expect(fieldOf("Ungültiges Zeitformat für Uhrzeit bis")).toEqual(["timeTo"]);
  });
});

it("ordnet Fremdtermin-Linkfehler dem Link-Feld zu", () => {
  expect(Object.keys(mapServerErrorToField("Link muss mit http:// oder https:// beginnen", EXTERNAL_EVENT_FIELD_KEYWORDS))).toEqual(["url"]);
});
