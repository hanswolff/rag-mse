export type CollisionKind = "termin" | "fremdtermin" | "abwesenheit";

export interface CollisionItem {
  kind: CollisionKind;
  id: string;
  startDate: string;
  endDate: string;
}

export interface CollisionSources {
  termine: { id: string; date: string }[];
  fremdtermine: { id: string; startDate: string; endDate: string }[];
  abwesenheiten: { id: string; startDate: string; endDate: string }[];
}

export interface CollisionResult {
  byTermin: Map<string, CollisionItem[]>;
  days: string[];
}

function toItems(sources: CollisionSources): CollisionItem[] {
  return [
    ...sources.termine.map(({ id, date }) => ({ kind: "termin" as const, id, startDate: date, endDate: date })),
    ...sources.fremdtermine.map(({ id, startDate, endDate }) => ({ kind: "fremdtermin" as const, id, startDate, endDate })),
    ...sources.abwesenheiten.map(({ id, startDate, endDate }) => ({ kind: "abwesenheit" as const, id, startDate, endDate })),
  ];
}

function touchesDay(item: CollisionItem, day: string): boolean {
  return item.startDate <= day && day <= item.endDate;
}

function isSameTermin(item: CollisionItem, terminId: string | undefined): boolean {
  return item.kind === "termin" && item.id === terminId;
}

export function findItemsOnDay(sources: CollisionSources, day: string, excludeTerminId?: string): CollisionItem[] {
  return toItems(sources).filter((item) => touchesDay(item, day) && !isSameTermin(item, excludeTerminId));
}

export function findCollisions(sources: CollisionSources): CollisionResult {
  const items = toItems(sources);
  const byTermin = new Map<string, CollisionItem[]>();
  const days = new Set<string>();

  for (const termin of sources.termine) {
    const colliding = items.filter((item) => touchesDay(item, termin.date) && !isSameTermin(item, termin.id));
    if (colliding.length === 0) continue;
    byTermin.set(termin.id, colliding);
    days.add(termin.date);
  }

  return { byTermin, days: [...days].sort() };
}
