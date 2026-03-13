import Link from "next/link";
import { VoteType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { formatDate, formatTime } from "@/lib/date-utils";
import { getEventDescriptionPreview } from "@/lib/event-description";
import { getStartOfToday } from "@/lib/date-picker-utils";
import { createShootingRangeLookup, getEventLocationDisplay, getRangeNameFromLocation } from "@/lib/event-location";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canAccessAdminArea, isAdmin } from "@/lib/role-utils";
import { PaginationLinks } from "@/components/pagination-links";
import { buildVisibilityFilter, getVoteLabel, parsePageParam } from "@/lib/event-list-utils";

const PAGE_SIZE = 20;

type EventRow = {
  id: string;
  date: Date;
  timeFrom: string;
  timeTo: string;
  location: string;
  description: string;
  type: string | null;
  visible: boolean;
  votes?: { vote: VoteType }[];
  guestRegistrations?: { vote: VoteType }[];
};

export const revalidate = 300;

export default async function TerminePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const currentPage = parsePageParam(page);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const canSeeAll = canAccessAdminArea(session?.user);
  const visibilityFilter = buildVisibilityFilter(userId, canSeeAll);
  const currentStart = getStartOfToday();

  const select = session?.user
    ? {
        id: true,
        date: true,
        timeFrom: true,
        timeTo: true,
        location: true,
        description: true,
        type: true,
        visible: true,
        votes: { select: { vote: true } },
        guestRegistrations: { select: { vote: true } },
      }
    : {
        id: true,
        date: true,
        timeFrom: true,
        timeTo: true,
        location: true,
        description: true,
        type: true,
        visible: true,
      };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where: {
        ...visibilityFilter,
        date: { gte: currentStart },
      },
      orderBy: [{ date: "asc" }, { timeFrom: "asc" }],
      select,
      skip,
      take: PAGE_SIZE,
    }),
    prisma.event.count({
      where: {
        ...visibilityFilter,
        date: { gte: currentStart },
      },
    }),
  ]);

  const rangeNames = events
    .map((event) => getRangeNameFromLocation(event.location))
    .filter((name) => name.length > 0);
  const uniqueRangeNames = [...new Set(rangeNames)];

  const ranges = uniqueRangeNames.length
    ? await prisma.shootingRange.findMany({
        where: { name: { in: uniqueRangeNames } },
        select: {
          name: true,
          street: true,
          postalCode: true,
          city: true,
        },
      })
    : [];

  const rangeLookup = createShootingRangeLookup(ranges);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Termine</h1>
          <p className="text-gray-600 mt-2 text-base sm:text-base">
            Aktuelle Termine und Veranstaltungen
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/termine/vergangenheit" className="link-primary text-base font-semibold">
              Termine in der Vergangenheit
            </Link>
          </div>
          {session && isAdmin(session.user) && (
            <div className="mt-2">
              <Link href="/admin/termine" className="btn-primary text-base font-semibold">
                Termine verwalten
              </Link>
            </div>
          )}
        </div>

        {events.length === 0 ? (
          <div className="card text-center">
            <p className="text-gray-500 text-base sm:text-base">Keine Termine gefunden</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {events.map((event) => (
              <article
                key={event.id}
                className="card-compact overflow-hidden hover:shadow-md transition-shadow"
              >
                <Link href={`/termine/${event.id}`} className="block">
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <h2 className="text-base sm:text-xl font-semibold text-gray-900 hover:text-brand-red-600 transition-colors">
                          {formatDate(event.date.toISOString())}
                        </h2>
                        {event.type && (
                          <span className={`px-2 py-0.5 text-base font-medium rounded ${
                            event.type === "Training"
                              ? "bg-brand-blue-50 text-brand-blue-800"
                              : "bg-orange-100 text-orange-800"
                          }`}>
                            {event.type}
                          </span>
                        )}
                        {!event.visible && (
                          <span className="px-2 py-0.5 text-base font-medium rounded bg-amber-100 text-amber-800">
                            Dieser Termin ist noch nicht öffentlich
                          </span>
                        )}
                      </div>
                      {session?.user && (
                        <span className="bg-brand-blue-50 text-brand-blue-800 text-base font-medium px-2.5 py-0.5 rounded self-start sm:self-auto">
                          {getVoteLabel(event as EventRow)}
                        </span>
                      )}
                    </div>
                    <p className="text-base sm:text-base text-gray-500 mb-2">
                      {formatTime(event.timeFrom)} - {formatTime(event.timeTo)}
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
            ))}
          </div>
        )}

        <PaginationLinks basePath="/termine" currentPage={currentPage} totalPages={totalPages} />
      </div>
    </main>
  );
}
