import {
  EVENT_REMINDER_DEFAULT_DAYS,
  EVENT_REMINDER_MAX_DAYS,
  EVENT_REMINDER_MIN_DAYS,
  isReminderDaysBeforeValid,
  validateReminderSettings,
} from "@/lib/notification-settings";
import {
  buildNotificationRsvpUrl,
  buildNotificationUnsubscribeUrl,
} from "@/lib/notification-links";

describe("notifications utils", () => {
  it("validates reminder range boundaries", () => {
    expect(isReminderDaysBeforeValid(EVENT_REMINDER_MIN_DAYS)).toBe(true);
    expect(isReminderDaysBeforeValid(EVENT_REMINDER_MAX_DAYS)).toBe(true);
    expect(isReminderDaysBeforeValid(EVENT_REMINDER_MIN_DAYS - 1)).toBe(false);
    expect(isReminderDaysBeforeValid(EVENT_REMINDER_MAX_DAYS + 1)).toBe(false);
  });

  it("accepts default settings", () => {
    const result = validateReminderSettings(true, EVENT_REMINDER_DEFAULT_DAYS);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects invalid values", () => {
    const result = validateReminderSettings("yes", 99);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("builds token urls", () => {
    expect(buildNotificationRsvpUrl("https://example.com", "abc")).toBe("https://example.com/anmeldung/abc");
    expect(buildNotificationUnsubscribeUrl("https://example.com", "def")).toBe(
      "https://example.com/benachrichtigungen/abmelden/def"
    );
  });
});
