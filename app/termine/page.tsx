export { metadata } from "./metadata";

import Link from "next/link";
import { getServerSession } from "next-auth";
import { getStartOfToday } from "@/lib/date-picker-utils";
import { createShootingRangeLookup, getRangeNameFromLocation } from "@/lib/event-location";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { canAccessAdminArea, isAdmin } from "@/lib/role-utils";
import { Pagination } from "@/components/pagination";
import { PageHeader } from "@/components/page-header";
import { EmptyCalendarIllustration } from "@/components/icons";
import { EventCard } from "@/components/event-card";
import { buildVisibilityFilter, parsePageParam } from "@/lib/event-list-utils";

const PAGE_SIZE = 20;

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
        title: true,
        description: true,
        type: true,
        visible: true,
        capacity: true,
        votes: { select: { vote: true } },
        guestRegistrations: { select: { vote: true } },
      }
    : {
        id: true,
        date: true,
        timeFrom: true,
        timeTo: true,
        location: true,
        title: true,
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
      <PageHeader
        title="Termine"
        subtitle="Aktuelle Termine unseres Verbandes"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 flex flex-wrap items-center gap-4">
          <Link href="/termine/vergangenheit" className="link-primary text-base font-semibold">
            Termine in der Vergangenheit
          </Link>
          {session && isAdmin(session.user) && (
            <Link href="/admin/termine" className="btn-primary text-base font-semibold">
              Termine verwalten
            </Link>
          )}
        </div>

        {events.length === 0 ? (
          <div className="card empty-state">
            <EmptyCalendarIllustration className="empty-state-icon" />
            <p className="text-gray-500 text-base sm:text-lg font-medium">Keine Termine gefunden</p>
            <p className="text-gray-400 text-sm mt-1">Neue Termine werden hier angezeigt</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                rangeLookup={rangeLookup}
                showVoteLabel={!!session?.user}
              />
            ))}
          </div>
        )}

        <Pagination basePath="/termine" currentPage={currentPage} totalPages={totalPages} />
      </div>
    </main>
  );
}
