export { metadata } from "./metadata";

import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageAdminArea } from "@/lib/role-utils";
import { Pagination } from "@/components/pagination";
import { PageHeader } from "@/components/page-header";
import { EmptyCalendarIllustration } from "@/components/empty-illustrations";
import { EventCard } from "@/components/event-card";
import { loadEventListPage } from "@/lib/event-list-utils";

export const revalidate = 300;

export default async function TerminePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const session = await getServerSession(authOptions);
  const { events, currentPage, totalPages, rangeLookup } = await loadEventListPage({
    direction: "upcoming",
    page,
    session,
  });

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
          {session && canManageAdminArea(session.user) && (
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
