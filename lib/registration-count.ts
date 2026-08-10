import { pluralize } from "@/lib/pluralization";

export interface RegistrationVoteCounts {
  JA: number;
  NEIN: number;
  VIELLEICHT: number;
}

export interface RegistrationRange {
  min: number;
  max: number;
}

export function getRegistrationRange(voteCounts: RegistrationVoteCounts): RegistrationRange {
  const min = voteCounts.JA;
  const max = voteCounts.JA + voteCounts.VIELLEICHT;
  return { min, max };
}

export function formatRegistrationCount(voteCounts: RegistrationVoteCounts): string {
  const { min, max } = getRegistrationRange(voteCounts);

  if (min === max) {
    return `${min} ${pluralize(min, "Anmeldung", "Anmeldungen")}`;
  }

  return `${min}-${max} Anmeldungen`;
}

// Belegt ist ein Platz nur durch eine Ja-Anmeldung; "Vielleicht" bleibt als
// sichtbare Unsicherheit daneben stehen. Siehe ADR 0003: Die Platzzahl sperrt nichts.
export function formatOccupancy(voteCounts: RegistrationVoteCounts, capacity: number): string {
  const { min, max } = getRegistrationRange(voteCounts);
  const occupancy = `${min} von ${capacity} ${pluralize(capacity, "Platz", "Plätzen")} belegt`;
  const undecided = max - min;

  return undecided > 0 ? `${occupancy} (+${undecided} vielleicht)` : occupancy;
}

export function isOverbooked(voteCounts: RegistrationVoteCounts, capacity: number): boolean {
  return getRegistrationRange(voteCounts).min > capacity;
}
