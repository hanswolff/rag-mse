import { getEventTypeBadgeClasses } from "@/lib/event-types";

const SIZE_CLASSES = {
  compact: "px-2 py-0.5",
  large: "px-3 py-1",
} as const;

type EventTypeBadgeProps = {
  type: string | null;
  size?: keyof typeof SIZE_CLASSES;
};

export function EventTypeBadge({ type, size = "compact" }: EventTypeBadgeProps) {
  if (!type) return null;

  return (
    <span
      className={`${SIZE_CLASSES[size]} text-base font-medium rounded ${getEventTypeBadgeClasses(type)}`}
    >
      {type}
    </span>
  );
}
