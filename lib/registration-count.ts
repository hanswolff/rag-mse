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
