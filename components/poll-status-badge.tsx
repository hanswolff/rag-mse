import type { ReactNode } from "react";

type PollBadgeSize = "sm" | "xs";

const SIZE_CLASSES: Record<PollBadgeSize, string> = {
  sm: "text-sm",
  xs: "text-xs",
};

export function PollBadge({
  color,
  size = "sm",
  children,
}: {
  color: string;
  size?: PollBadgeSize;
  children: ReactNode;
}) {
  return (
    <span className={`px-2 py-0.5 ${SIZE_CLASSES[size]} font-medium rounded ${color}`}>
      {children}
    </span>
  );
}

export function PollStatusBadge({ status, size }: { status: string; size?: PollBadgeSize }) {
  if (status === "CLOSED") {
    return (
      <PollBadge color="bg-red-100 text-red-800" size={size}>
        Geschlossen
      </PollBadge>
    );
  }
  return (
    <PollBadge color="bg-green-100 text-green-800" size={size}>
      Offen
    </PollBadge>
  );
}

export function PollVoteBadge({ hasVoted, size }: { hasVoted: boolean; size?: PollBadgeSize }) {
  if (hasVoted) {
    return (
      <PollBadge color="bg-green-100 text-green-800" size={size}>
        Abgestimmt
      </PollBadge>
    );
  }
  return (
    <PollBadge color="bg-amber-100 text-amber-800" size={size}>
      Offen
    </PollBadge>
  );
}
