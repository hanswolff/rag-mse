import { Visibility } from "@prisma/client";

export { Visibility };

export const VISIBILITIES = [Visibility.PUBLIC, Visibility.MEMBER, Visibility.HIDDEN] as const;

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  [Visibility.PUBLIC]: "Öffentlich",
  [Visibility.MEMBER]: "Nur für Mitglieder",
  [Visibility.HIDDEN]: "Verborgen",
};

export const VISIBILITY_BADGE_CLASSES: Record<Visibility, string> = {
  [Visibility.PUBLIC]: "badge visibility-badge-public",
  [Visibility.MEMBER]: "badge visibility-badge-member",
  [Visibility.HIDDEN]: "badge visibility-badge-hidden",
};

export function getVisibilityErrorMessage(field: string): string {
  const options = VISIBILITIES.map((visibility) => `${VISIBILITY_LABELS[visibility]} (${visibility})`);
  return `${field} muss ${options.slice(0, -1).join(", ")} oder ${options.at(-1)} sein`;
}

export function parseVisibility(value: unknown): Visibility | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return VISIBILITIES.find((visibility) => visibility === value);
}

// HIDDEN fehlt bewusst: wer Verborgenes sieht, regelt das jeweilige Modell (ADR-0011).
export function getVisibleVisibilities(isLoggedIn: boolean): Visibility[] {
  return isLoggedIn ? [Visibility.PUBLIC, Visibility.MEMBER] : [Visibility.PUBLIC];
}

export function canView(visibility: Visibility, isLoggedIn: boolean): boolean {
  return getVisibleVisibilities(isLoggedIn).includes(visibility);
}

export function getVisibilityFilter(isLoggedIn: boolean) {
  return { visibility: { in: getVisibleVisibilities(isLoggedIn) } };
}
