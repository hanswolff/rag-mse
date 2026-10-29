import Link from "next/link";
import type { Poll } from "@/types";
import { getPollTypeLabel } from "@/lib/poll-labels";
import { formatDate } from "@/lib/date-utils";
import { PollBadge, PollStatusBadge, PollVoteBadge } from "@/components/poll-status-badge";

export type CompactPollCardData = Omit<Poll, "type" | "event" | "status"> & { status: string };

type PollCardProps =
  | { poll: Poll; variant?: "list" | "archive" }
  | { poll: CompactPollCardData; variant: "compact" };

function CompactPollCard({ poll }: { poll: CompactPollCardData }) {
  return (
    <Link
      href={`/umfragen/${poll.id}`}
      className="block p-4 rounded-lg border border-gray-200 hover:border-brand-red-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold text-gray-900 hover:text-brand-red-600">{poll.title}</span>
        <div className="flex items-center gap-2">
          <PollVoteBadge hasVoted={poll.userVoteOptionIds.length > 0} size="xs" />
          {poll.status === "CLOSED" && <PollStatusBadge status={poll.status} size="xs" />}
        </div>
      </div>
      {poll.description && (
        <p className="text-sm text-gray-600 line-clamp-1">{poll.description}</p>
      )}
      <p className="text-xs text-gray-500 mt-1">
        {poll.options.length} Optionen · {poll._count.votes} Stimmen
      </p>
    </Link>
  );
}

export function PollCard(props: PollCardProps) {
  if (props.variant === "compact") {
    return <CompactPollCard poll={props.poll} />;
  }

  const { poll, variant = "list" } = props;
  return (
    <Link
      href={`/umfragen/${poll.id}`}
      className="block card-compact p-4 sm:p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <h3 className="text-lg font-semibold text-gray-900 hover:text-brand-red-600 transition-colors">
          {poll.title}
        </h3>
        <div className="flex items-center gap-2">
          <PollBadge color="bg-brand-blue-50 text-brand-blue-800">
            {getPollTypeLabel(poll.type)}
          </PollBadge>
          {variant === "list" && poll.multipleChoice && (
            <PollBadge color="bg-purple-50 text-purple-800">Mehrfachauswahl</PollBadge>
          )}
          {variant === "list" && poll.status !== "CLOSED" ? (
            <PollVoteBadge hasVoted={poll.userVoteOptionIds.length > 0} />
          ) : (
            <PollStatusBadge status={poll.status} />
          )}
        </div>
      </div>
      {poll.description && (
        <p className="text-gray-600 text-sm line-clamp-2">{poll.description}</p>
      )}
      {poll.type === "TERMIN" && poll.event && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-brand-blue-100 bg-brand-blue-50/50 px-3 py-2 text-sm">
          <span className="shrink-0 mt-0.5">📅</span>
          <div>
            <p className="font-medium text-brand-blue-800">
              {formatDate(poll.event.date)}, {poll.event.timeFrom} – {poll.event.timeTo} Uhr
            </p>
            <p className="text-brand-blue-600">{poll.event.location}</p>
          </div>
        </div>
      )}
      <p className="text-sm text-gray-500 mt-2">
        {poll.options.length} Optionen · {poll._count.votes} Stimmen abgegeben
      </p>
    </Link>
  );
}
