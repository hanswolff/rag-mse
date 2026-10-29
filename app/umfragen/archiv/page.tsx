"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { PageHeader } from "@/components/page-header";
import { useProtectedPage } from "@/lib/use-protected-page";
import { AlertBox } from "@/components/alert-box";
import { Pagination } from "@/components/pagination";
import { PollCard } from "@/components/poll-card";
import type { Poll } from "@/types";

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
        `/api/polls?status=CLOSED&before=${encodeURIComponent(before)}&limit=${PAGE_SIZE}&page=${page}`,
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
              <PollCard key={poll.id} poll={poll} variant="archive" />
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
