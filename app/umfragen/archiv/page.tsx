"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getPollTypeLabel } from "@/lib/poll-labels";
import { formatDate } from "@/lib/date-utils";
import { LoadingScreen } from "@/components/loading-screen";
import { PageHeader } from "@/components/page-header";
import { useProtectedPage } from "@/lib/use-protected-page";
import { AlertBox } from "@/components/alert-box";
import { Pagination } from "@/components/pagination";

interface PollOption {
  id: string;
  text: string;
  position: number;
  _count: { votes: number };
}

interface Poll {
  id: string;
  title: string;
  description: string | null;
  type: "TERMIN" | "SONSTIGES";
  status: string;
  multipleChoice: boolean;
  shortCode: string | null;
  options: PollOption[];
  _count: { votes: number };
  userVoteOptionIds: string[];
  event?: { id: string; date: string; timeFrom: string; timeTo: string; location: string; description: string } | null;
}

const PAGE_SIZE = 20;

export default function UmfragenArchivPage() {
  const { status } = useProtectedPage();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPolls = useCallback(async (page: number, signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const before = cutoff.toISOString();
      const response = await fetch(
        `/api/polls?status=LIVE,CLOSED&before=${encodeURIComponent(before)}&limit=${PAGE_SIZE}&page=${page}`,
        { signal },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Laden");
      }
      const data = await response.json();
      setPolls(data.polls);
      setTotalPages(data.pagination.pages || 1);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    void fetchPolls(currentPage, controller.signal);
    return () => controller.abort();
  }, [status, currentPage, fetchPolls]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (isLoading && polls.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <main className="flex-1 bg-gray-50">
      <PageHeader title="Umfragen-Archiv" subtitle="Ältere Umfragen" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6">
          <Link href="/umfragen" className="link-primary text-base font-semibold">
            ← Aktuelle Umfragen
          </Link>
        </div>

        <AlertBox type="error" message={error} className="mb-4" />

        {polls.length === 0 && !isLoading ? (
          <div className="card empty-state">
            <p className="text-gray-500 text-lg font-medium">Keine älteren Umfragen vorhanden</p>
          </div>
        ) : (
          <div className="space-y-4">
            {polls.map((poll) => (
              <Link
                key={poll.id}
                href={`/umfragen/${poll.id}`}
                className="block card-compact p-4 sm:p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 hover:text-brand-red-600 transition-colors">
                    {poll.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-sm font-medium rounded bg-brand-blue-50 text-brand-blue-800">
                      {getPollTypeLabel(poll.type)}
                    </span>
                    {poll.status === "CLOSED" ? (
                      <span className="px-2 py-0.5 text-sm font-medium rounded bg-red-100 text-red-800">
                        Geschlossen
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-sm font-medium rounded bg-green-100 text-green-800">
                        Offen
                      </span>
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
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          disabled={isLoading}
        />
      </div>
    </main>
  );
}
