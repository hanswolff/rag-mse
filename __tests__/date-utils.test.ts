import { formatDate, formatTime, formatDateTimeRange, isEventInPast } from "@/lib/date-utils";
import {
  getStartOfToday,
  formatDateForStorage,
  parseDateAndTime,
  getLocalDateString,
  parseIsoDateOnlyToUtcDate,
} from "@/lib/date-picker-utils";

describe("date-utils", () => {
  describe("formatDate", () => {
    it("formats date in German locale", () => {
      const date = "2024-01-15T00:00:00.000Z";
      const formatted = formatDate(date);
      expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    });

    it("handles ISO string dates", () => {
      const date = "2024-12-25T10:30:00.000Z";
      const formatted = formatDate(date);
      expect(formatted).toContain("2024");
      expect(formatted).toContain("25");
      expect(formatted).toContain("12");
    });

    it("handles date strings", () => {
      const date = "2024-06-01";
      const formatted = formatDate(date);
      expect(formatted).toContain("2024");
      expect(formatted).toContain("01");
      expect(formatted).toContain("06");
    });

    it("keeps date-only part stable for UTC timestamps", () => {
      const date = "2026-01-15T00:00:00.000Z";
      expect(formatDate(date)).toBe("15.01.2026");
    });
  });

  describe("formatTime", () => {
    it("formats time in 24-hour German format", () => {
      const time = "14:30";
      const formatted = formatTime(time);
      expect(formatted).toBe("14:30");
    });

    it("handles morning times", () => {
      const time = "09:15";
      const formatted = formatTime(time);
      expect(formatted).toBe("09:15");
    });

    it("handles late night times", () => {
      const time = "23:45";
      const formatted = formatTime(time);
      expect(formatted).toBe("23:45");
    });

    it("handles midnight", () => {
      const time = "00:00";
      const formatted = formatTime(time);
      expect(formatted).toBe("00:00");
    });
  });

  describe("formatDateTimeRange", () => {
    it("formats date with time range", () => {
      const date = "2024-01-15";
      const timeFrom = "14:00";
      const timeTo = "16:00";
      const formatted = formatDateTimeRange(date, timeFrom, timeTo);
      expect(formatted).toContain("14:00");
      expect(formatted).toContain("16:00");
      expect(formatted).toContain("2024");
    });

    it("formats date with single time", () => {
      const date = "2024-01-15";
      const timeFrom = "14:00";
      const formatted = formatDateTimeRange(date, timeFrom);
      expect(formatted).toContain("14:00");
      expect(formatted).toContain("2024");
    });

    it("handles undefined timeTo", () => {
      const date = "2024-01-15";
      const timeFrom = "14:00";
      const formatted = formatDateTimeRange(date, timeFrom, undefined);
      expect(formatted).toContain("14:00");
      expect(formatted).not.toContain("-");
    });
  });

  describe("isEventInPast", () => {
    it("returns true for event date in the past (yesterday)", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isEventInPast(yesterday.toISOString())).toBe(true);
    });

    it("returns true for event date far in the past", () => {
      const pastDate = "2024-01-01";
      expect(isEventInPast(pastDate)).toBe(true);
    });

    it("returns false for event date today", () => {
      const today = new Date();
      expect(isEventInPast(today.toISOString())).toBe(false);
    });

    it("returns false for event date in the future", () => {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      expect(isEventInPast(future.toISOString())).toBe(false);
    });

    it("returns false for event date far in the future", () => {
      const futureDate = "2026-12-31";
      expect(isEventInPast(futureDate)).toBe(false);
    });

    it("handles Date object input", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isEventInPast(yesterday)).toBe(true);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isEventInPast(tomorrow)).toBe(false);
    });

    it("handles ISO string input", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isEventInPast(yesterday.toISOString())).toBe(true);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isEventInPast(tomorrow.toISOString())).toBe(false);
    });

    it("handles date string without time", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateString = yesterday.toISOString().split('T')[0];
      expect(isEventInPast(dateString)).toBe(true);
    });

    it("handles edge case: start of today", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expect(isEventInPast(today.toISOString())).toBe(false);
    });

    it("handles edge case: end of yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 59, 999);
      expect(isEventInPast(yesterday.toISOString())).toBe(true);
    });

    it("handles leap year dates", () => {
      const leapDay = "2024-02-29";
      expect(isEventInPast(leapDay)).toBe(true);

      const futureLeapDay = "2028-02-29";
      expect(isEventInPast(futureLeapDay)).toBe(false);
    });

    it("handles month boundaries", () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      expect(isEventInPast(lastMonth.toISOString())).toBe(true);

      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      expect(isEventInPast(nextMonth.toISOString())).toBe(false);
    });

    it("handles year boundaries", () => {
      expect(isEventInPast("2023-12-31")).toBe(true);
      expect(isEventInPast("2027-01-01")).toBe(false);
    });
  });
});

describe("date-picker-utils", () => {
  describe("getStartOfToday", () => {
    it("returns start of current day", () => {
      const result = getStartOfToday();
      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it("returns same day as current date", () => {
      const now = new Date();
      const result = getStartOfToday();
      expect(result.getDate()).toBe(now.getDate());
      expect(result.getMonth()).toBe(now.getMonth());
      expect(result.getFullYear()).toBe(now.getFullYear());
    });
  });

  describe("formatDateForStorage", () => {
    it("formats date to yyyy-MM-dd format", () => {
      const date = new Date("2024-02-05T15:30:00.000Z");
      const result = formatDateForStorage(date);
      expect(result).toBe("2024-02-05");
    });

    it("handles different months", () => {
      const date = new Date("2024-12-25T12:00:00.000Z");
      const result = formatDateForStorage(date);
      expect(result).toBe("2024-12-25");
    });

    it("handles single digit month and day", () => {
      const date = new Date("2024-01-01T00:00:00.000Z");
      const result = formatDateForStorage(date);
      expect(result).toBe("2024-01-01");
    });
  });

  describe("parseDateAndTime", () => {
    it("combines valid date and time strings", () => {
      const result = parseDateAndTime("2024-02-05", "14:30");
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(1);
      expect(result.getDate()).toBe(5);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it("handles midnight", () => {
      const result = parseDateAndTime("2024-02-05", "00:00");
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it("handles late night", () => {
      const result = parseDateAndTime("2024-02-05", "23:59");
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
    });

    it("throws error for invalid date string", () => {
      expect(() => parseDateAndTime("invalid", "14:30")).toThrow("Invalid date string: invalid");
    });

    it("throws error for invalid time string", () => {
      expect(() => parseDateAndTime("2024-02-05", "invalid")).toThrow("Invalid time string: invalid");
    });

    it("throws error for malformed time", () => {
      expect(() => parseDateAndTime("2024-02-05", "25:00")).toThrow();
    });

    it("handles leap year dates", () => {
      const result = parseDateAndTime("2024-02-29", "12:00");
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(1);
      expect(result.getDate()).toBe(29);
    });
  });

  describe("getLocalDateString", () => {
    it("returns local yyyy-MM-dd string", () => {
      const date = new Date(2026, 0, 5, 15, 30, 0, 0);
      expect(getLocalDateString(date)).toBe("2026-01-05");
    });
  });

  describe("parseIsoDateOnlyToUtcDate", () => {
    it("parses date-only value as UTC midnight", () => {
      const date = parseIsoDateOnlyToUtcDate("2026-01-15");
      expect(date.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    });

    it("throws for invalid date-only value", () => {
      expect(() => parseIsoDateOnlyToUtcDate("2026-01-15T00:00:00.000Z")).toThrow(
        "Invalid ISO date-only string: 2026-01-15T00:00:00.000Z"
      );
    });
  });
});
