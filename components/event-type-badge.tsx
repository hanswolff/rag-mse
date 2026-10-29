import { getEventTypeBadgeClasses } from "@/lib/event-types";

const SIZE_CLASSES = {
  compact: "",
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
      className={`badge ${SIZE_CLASSES[size]} ${getEventTypeBadgeClasses(type)}`}
    >
      {type}
    </span>
  );
}
