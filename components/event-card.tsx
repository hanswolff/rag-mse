import Link from "next/link";
import { VoteType } from "@prisma/client";
import { formatDate, formatTime } from "@/lib/date-utils";
import { getEventDescriptionPreview } from "@/lib/event-description";
import { getEventLocationDisplay } from "@/lib/event-location";
import { getVoteLabel } from "@/lib/event-list-utils";
import { EventTypeBadge } from "@/components/event-type-badge";

export type EventCardData = {
  id: string;
  date: Date;
  timeFrom: string;
  timeTo: string;
  location: string;
  title: string | null;
  description: string;
  type: string | null;
  capacity?: number | null;
  visible: boolean;
  votes?: { vote: VoteType }[];
  guestRegistrations?: { vote: VoteType }[];
};

type EventCardProps = {
  event: EventCardData;
  rangeLookup: Map<string, { name: string; street: string | null; postalCode: string | null; city: string | null }>;
  showVoteLabel: boolean;
};

export function EventCard({ event, rangeLookup, showVoteLabel }: EventCardProps) {
  const eventDate = formatDate(event.date.toISOString());
  const timeRange = `${formatTime(event.timeFrom)} - ${formatTime(event.timeTo)}`;

  return (
    <article className="card-compact overflow-hidden hover:shadow-md transition-shadow">
      <Link href={`/termine/${event.id}`} className="block">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h2 className="text-base sm:text-xl font-semibold text-gray-900 hover:text-brand-red-600 transition-colors">
                {event.title || eventDate}
              </h2>
              <EventTypeBadge type={event.type} />
              {!event.visible && (
                <span className="px-2 py-0.5 text-base font-medium rounded bg-amber-100 text-amber-800">
                  Dieser Termin ist noch nicht öffentlich
                </span>
              )}
            </div>
            {showVoteLabel && (
              <span className="bg-brand-blue-50 text-brand-blue-800 text-base font-medium px-2.5 py-0.5 rounded self-start sm:self-auto">
                {getVoteLabel(event)}
              </span>
            )}
          </div>
          <p className="text-base sm:text-base text-gray-500 mb-2">
            {event.title ? `${eventDate}, ${timeRange}` : timeRange}
          </p>
          <p className="text-gray-600 mb-2 font-medium text-base sm:text-base">
            {getEventLocationDisplay(event.location, rangeLookup)}
          </p>
          <p className="text-gray-600 line-clamp-2 text-base sm:text-base">
            {getEventDescriptionPreview(event.description)}
          </p>
        </div>
      </Link>
    </article>
  );
}
