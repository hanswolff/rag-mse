import { Visibility, getVisibleVisibilities } from "@/lib/visibility";

type Viewer = { userId?: string; canSeeAll: boolean };

export type EventAccess = "granted" | "login-required" | "not-found";

export function buildVisibilityFilter(userId: string | undefined, canSeeAll: boolean) {
  if (canSeeAll) {
    return {};
  }
  const visibleLevels = { visibility: { in: getVisibleVisibilities(Boolean(userId)) } };
  if (userId) {
    return { OR: [visibleLevels, { createdById: userId }] };
  }
  return visibleLevels;
}

export function getEventAccess(
  event: { visibility: Visibility; createdById: string | null },
  { userId, canSeeAll }: Viewer
): EventAccess {
  if (canSeeAll || getVisibleVisibilities(Boolean(userId)).includes(event.visibility)) {
    return "granted";
  }
  if (event.visibility === Visibility.MEMBER) {
    return "login-required";
  }
  return userId && event.createdById === userId ? "granted" : "not-found";
}

type GuardedEvent = { visibility: Visibility; createdById: string | null };

export function redactInvisibleEvent<T extends GuardedEvent>(
  event: T | null,
  viewer: Viewer
): Omit<T, keyof GuardedEvent> | null {
  if (!event || getEventAccess(event, viewer) !== "granted") {
    return null;
  }
  const { visibility, createdById, ...visibleEvent } = event;
  void visibility;
  void createdById;
  return visibleEvent;
}
