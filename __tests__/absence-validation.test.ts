import { absenceFormSchema, absenceValidationConfig, MAX_ABSENCE_REASON_LENGTH } from "@/lib/validation-schema";

const VALID = { startDate: "2026-11-06", endDate: "2026-11-06", allDay: true, timeFrom: "", timeTo: "", reason: "" };

describe("absenceFormSchema", () => {
  it("akzeptiert einen ganztägigen Zeitraum ohne Grund", () => {
    expect(absenceFormSchema.safeParse(VALID).success).toBe(true);
  });

  it("trimmt den Grund und begrenzt ihn auf 200 Zeichen", () => {
    expect(absenceFormSchema.parse({ ...VALID, reason: "  Schicht  " }).reason).toBe("Schicht");
    expect(absenceFormSchema.safeParse({ ...VALID, reason: "x".repeat(MAX_ABSENCE_REASON_LENGTH) }).success).toBe(true);
    const tooLong = absenceFormSchema.safeParse({ ...VALID, reason: "x".repeat(MAX_ABSENCE_REASON_LENGTH + 1) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0]).toMatchObject({ path: ["reason"], message: "Grund darf maximal 200 Zeichen haben" });
  });

  it("nutzt die gemeinsame Zeitraum-Prüfung", () => {
    const result = absenceFormSchema.safeParse({ ...VALID, endDate: "2026-11-05" });
    expect(result.error?.issues[0]).toMatchObject({ path: ["endDate"] });
  });

  it("erlaubt höchstens 365 Kalendertage", () => {
    expect(absenceFormSchema.safeParse({ ...VALID, startDate: "2026-11-06", endDate: "2027-11-05" }).success).toBe(true);
    const tooLong = absenceFormSchema.safeParse({ ...VALID, startDate: "2026-11-06", endDate: "2027-11-06" });
    expect(tooLong.error?.issues).toEqual([
      expect.objectContaining({ path: ["endDate"], message: "Eine Abwesenheit darf höchstens 365 Tage dauern" }),
    ]);
  });

  it("stellt Feldregeln für die Formularprüfung bereit", () => {
    expect(Object.keys(absenceValidationConfig)).toEqual(["startDate", "endDate", "timeFrom", "timeTo", "reason"]);
  });
});
