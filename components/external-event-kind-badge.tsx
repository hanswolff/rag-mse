import { EXTERNAL_EVENT_KIND_LABELS, type ExternalEventKind } from "@/lib/external-event-kind";

type ExternalEventKindBadgeProps = {
  kind: ExternalEventKind;
  className?: string;
};

export function ExternalEventKindBadge({ kind, className }: ExternalEventKindBadgeProps) {
  const classes = className ? `badge external-event-kind-badge ${className}` : "badge external-event-kind-badge";
  return <span className={classes}>{EXTERNAL_EVENT_KIND_LABELS[kind]}</span>;
}
