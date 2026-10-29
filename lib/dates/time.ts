export function parseTimeParts(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(":").map((value) => Number.parseInt(value, 10));
  return {
    hours: Number.isInteger(hours) ? hours : 0,
    minutes: Number.isInteger(minutes) ? minutes : 0,
  };
}

// Gültig nur, wenn „Uhrzeit bis“ strikt nach „Uhrzeit von“ liegt (gleicher Tag).
export function isTimeRangeValid(timeFrom: string, timeTo: string): boolean {
  const from = parseTimeParts(timeFrom);
  const to = parseTimeParts(timeTo);
  return from.hours * 60 + from.minutes < to.hours * 60 + to.minutes;
}
