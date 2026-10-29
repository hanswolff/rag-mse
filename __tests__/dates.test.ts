import {
  buildEventDateTime,
  formatDateOnlyForInput,
  formatDateTime,
  formatDateUtc,
  formatLocalDateForInput,
  getAppTimeZone,
  isTimeRangeValid,
} from "@/lib/dates";

describe("lib/dates", () => {
  describe("getAppTimeZone", () => {
    const originalTimeZone = process.env.APP_TIMEZONE;

    afterEach(() => {
      if (originalTimeZone === undefined) {
        delete process.env.APP_TIMEZONE;
      } else {
        process.env.APP_TIMEZONE = originalTimeZone;
      }
    });

    it("defaults to Europe/Berlin", () => {
      delete process.env.APP_TIMEZONE;
      expect(getAppTimeZone()).toBe("Europe/Berlin");
    });

    it("uses APP_TIMEZONE when set", () => {
      process.env.APP_TIMEZONE = "UTC";
      expect(getAppTimeZone()).toBe("UTC");
    });
  });

  describe("buildEventDateTime", () => {
    it("converts wall time in Europe/Berlin to UTC (winter time)", () => {
      const result = buildEventDateTime(new Date("2026-02-20T00:00:00.000Z"), "18:00", "Europe/Berlin");
      expect(result.toISOString()).toBe("2026-02-20T17:00:00.000Z");
    });

    it("converts wall time in Europe/Berlin to UTC (summer time)", () => {
      const result = buildEventDateTime(new Date("2026-06-04T00:00:00.000Z"), "18:00", "Europe/Berlin");
      expect(result.toISOString()).toBe("2026-06-04T16:00:00.000Z");
    });

    it("respects an explicit time zone independent of the server zone", () => {
      const result = buildEventDateTime(new Date("2026-06-04T00:00:00.000Z"), "18:00", "UTC");
      expect(result.toISOString()).toBe("2026-06-04T18:00:00.000Z");
    });
  });

  describe("isTimeRangeValid", () => {
    it("accepts a range where timeTo is after timeFrom", () => {
      expect(isTimeRangeValid("09:00", "12:30")).toBe(true);
    });

    it("rejects equal times", () => {
      expect(isTimeRangeValid("09:00", "09:00")).toBe(false);
    });

    it("rejects a range where timeTo is before timeFrom", () => {
      expect(isTimeRangeValid("18:00", "17:59")).toBe(false);
    });
  });

  describe("formatDateOnlyForInput", () => {
    it("formats ISO date string for date input (UTC calendar day)", () => {
      expect(formatDateOnlyForInput("2024-01-15T00:00:00.000Z")).toBe("2024-01-15");
      expect(formatDateOnlyForInput("2024-12-31T23:59:59.999Z")).toBe("2024-12-31");
    });

    it("returns empty string for invalid date", () => {
      expect(formatDateOnlyForInput("invalid")).toBe("");
      expect(formatDateOnlyForInput("")).toBe("");
    });
  });

  describe("formatLocalDateForInput", () => {
    it("keeps date-only strings unchanged", () => {
      expect(formatLocalDateForInput("2026-06-05")).toBe("2026-06-05");
    });

    it("formats event timestamps to the local calendar day", () => {
      expect(formatLocalDateForInput("2026-06-04T00:00:00.000Z")).toBe("2026-06-04");
    });

    it("returns the input unchanged for invalid values", () => {
      expect(formatLocalDateForInput("invalid")).toBe("invalid");
    });
  });

  describe("formatDateTime", () => {
    it("formats date and time in German locale", () => {
      const result = formatDateTime("2024-01-15T14:30:00.000Z");
      expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it("returns original value for invalid date", () => {
      expect(formatDateTime("invalid")).toBe("invalid");
      expect(formatDateTime("")).toBe("");
    });
  });

  describe("formatDateUtc", () => {
    it("formats UTC date in German locale", () => {
      expect(formatDateUtc("2024-01-15T00:00:00.000Z")).toBe("15.01.2024");
    });

    it("returns original value for invalid date", () => {
      expect(formatDateUtc("invalid")).toBe("invalid");
      expect(formatDateUtc("")).toBe("");
    });
  });
});
