export const EVENT_REMINDER_MIN_DAYS = 1;
export const EVENT_REMINDER_MAX_DAYS = 14;
export const EVENT_REMINDER_DEFAULT_DAYS = 7;

export function isReminderDaysBeforeValid(value: number): boolean {
  return Number.isInteger(value) && value >= EVENT_REMINDER_MIN_DAYS && value <= EVENT_REMINDER_MAX_DAYS;
}

export function validateReminderSettings(
  enabled: unknown,
  daysBefore: unknown
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (enabled !== undefined && typeof enabled !== "boolean") {
    errors.push("Benachrichtigung muss true oder false sein");
  }

  if (daysBefore !== undefined) {
    if (!Number.isInteger(daysBefore)) {
      errors.push("Tage vor Termin müssen eine ganze Zahl sein");
    } else if (!isReminderDaysBeforeValid(daysBefore as number)) {
      errors.push(`Tage vor Termin müssen zwischen ${EVENT_REMINDER_MIN_DAYS} und ${EVENT_REMINDER_MAX_DAYS} liegen`);
    }
  }

  return { isValid: errors.length === 0, errors };
}
