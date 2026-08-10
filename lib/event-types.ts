export const EVENT_TYPES = ["Training", "Wettkampf", "Lehrgang"] as const;

export type EventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_BADGE_CLASSES: Record<string, string> = {
  Training: "bg-brand-blue-50 text-brand-blue-800",
  Wettkampf: "bg-orange-100 text-orange-800",
  Lehrgang: "bg-brand-gold-100 text-brand-gold-800",
};

const NEUTRAL_BADGE_CLASSES = "bg-gray-100 text-gray-800";

export const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Kein Typ" },
  ...EVENT_TYPES.map((type) => ({ value: type, label: type })),
];

export function isEventType(type: string): type is EventType {
  return EVENT_TYPES.includes(type as EventType);
}

export function getEventTypeBadgeClasses(type: string): string {
  return EVENT_TYPE_BADGE_CLASSES[type] ?? NEUTRAL_BADGE_CLASSES;
}

export function describeAllowedEventTypes(): string {
  return `${EVENT_TYPES.join(", ")} oder leer`;
}
