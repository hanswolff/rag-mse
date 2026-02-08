"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { formatDate, formatTime } from "@/lib/date-utils";
import { Pagination } from "@/components/pagination";
import { isAdmin } from "@/lib/role-utils";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { getEventDescriptionPreview } from "@/lib/event-description";
import type { Event } from "@/types";

interface EventListResponse {
  pastEvents: Event[];
  pastPagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export default function VergangeneTerminePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [pastEventsData, setPastEventsData] = useState<Event[]>([]);
  const [pastPagination, setPastPagination] = useState<{
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>({ total: 0, page: 1, limit: 20, pages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pastPage, setPastPage] = useState(1);

  useEffect(() => {
    fetchEvents(pastPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastPage]);

  async function fetchEvents(page: number) {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/events?pastPage=${page}&limit=20`);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
          return;
        }
        throw new Error("Fehler beim Laden der Termine");
      }

      const data: EventListResponse = await response.json();
      setPastEventsData(data.pastEvents);
      setPastPagination(data.pastPagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  function handlePastPageChange(newPage: number) {
    setPastPage(newPage);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Termine in der Vergangenheit</h1>
          <p className="text-gray-600 mt-2 text-base sm:text-base">
            Rückblick auf vergangene Veranstaltungen
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/termine" className="link-primary text-base font-semibold">
              Aktuelle Termine
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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-3 rounded mb-4 text-base">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-gray-600 text-center py-8">Laden...</div>
        ) : pastEventsData.length === 0 ? (
          <div className="card text-center">
            <p className="text-gray-500 text-base sm:text-base">Keine vergangenen Termine gefunden</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {pastEventsData.map((event) => (
              <article
                key={event.id}
                className="card-compact overflow-hidden hover:shadow-md transition-shadow"
              >
                <Link href={`/termine/${event.id}`} className="block">
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-xl font-semibold text-gray-900 hover:text-brand-red-600 transition-colors">
                          {formatDate(event.date)}
                        </h2>
                        {event.type && (
                          <span
                            className={`px-2 py-0.5 text-base font-medium rounded ${
                              event.type === "Training"
                                ? "bg-brand-blue-50 text-brand-blue-800"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {event.type}
                          </span>
                        )}
                        {!event.visible && (
                          <span className="px-2 py-0.5 text-base font-medium rounded bg-amber-100 text-amber-800">
                            Dieser Termin ist noch nicht öffentlich
                          </span>
                        )}
                      </div>
                      {session && event._count && (
                        <span className="bg-brand-blue-50 text-brand-blue-800 text-base font-medium px-2.5 py-0.5 rounded">
                          {event._count.votes} Stimme{event._count.votes !== 1 ? "n" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-base sm:text-base text-gray-500 mb-2">
                      {formatTime(event.timeFrom)} - {formatTime(event.timeTo)}
                    </p>
                    <p className="text-gray-600 mb-2 font-medium text-base sm:text-base">
                      {event.location}
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

        <Pagination
          currentPage={pastPage}
          totalPages={pastPagination.pages}
          onPageChange={handlePastPageChange}
          disabled={isLoading || pastEventsData.length === 0}
        />
      </div>
    </main>
  );
}
