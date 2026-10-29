import { ExternalEventKind } from "@prisma/client";

export { ExternalEventKind };

export const EXTERNAL_EVENT_KINDS = [
  ExternalEventKind.RDL,
  ExternalEventKind.RK_EVENT,
  ExternalEventKind.COMPETITION,
  ExternalEventKind.OTHER,
] as const;

export const EXTERNAL_EVENT_KIND_LABELS: Record<ExternalEventKind, string> = {
  [ExternalEventKind.RDL]: "RDL",
  [ExternalEventKind.RK_EVENT]: "RK-Veranstaltung",
  [ExternalEventKind.COMPETITION]: "Wettkampf",
  [ExternalEventKind.OTHER]: "Sonstiges",
};

export const EXTERNAL_EVENT_KIND_ERROR = `Art muss ${EXTERNAL_EVENT_KINDS.slice(0, -1)
  .map((kind) => EXTERNAL_EVENT_KIND_LABELS[kind])
  .join(", ")} oder ${EXTERNAL_EVENT_KIND_LABELS[ExternalEventKind.OTHER]} sein`;

export function parseExternalEventKind(value: unknown): ExternalEventKind | undefined {
  return EXTERNAL_EVENT_KINDS.find((kind) => kind === value);
}
