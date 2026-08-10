import { VoteType } from "@prisma/client";
import { formatOccupancy, formatRegistrationCount } from "@/lib/registration-count";

type VoteBucket = {
  JA: number;
  NEIN: number;
  VIELLEICHT: number;
};

type EventVotesLike = {
  votes?: { vote: VoteType }[];
  guestRegistrations?: { vote: VoteType }[];
  capacity?: number | null;
};

export function parsePageParam(value: string | undefined): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

export function buildVisibilityFilter(userId: string | undefined, canSeeAll: boolean) {
  if (canSeeAll) {
    return {};
  }
  if (userId) {
    return { OR: [{ visible: true }, { createdById: userId }] };
  }
  return { visible: true };
}

export function getVoteLabel(event: EventVotesLike): string {
  const base: VoteBucket = { JA: 0, NEIN: 0, VIELLEICHT: 0 };
  for (const vote of event.votes || []) {
    base[vote.vote] += 1;
  }
  for (const guest of event.guestRegistrations || []) {
    base[guest.vote] += 1;
  }
  if (typeof event.capacity === "number") {
    return formatOccupancy(base, event.capacity);
  }
  return formatRegistrationCount(base);
}
