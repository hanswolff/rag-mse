"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LoadingScreen } from "@/components/loading-screen";
import { PageHeader } from "@/components/page-header";
import { useProtectedPage } from "@/lib/use-protected-page";
import { AlertBox } from "@/components/alert-box";
import { canManageAdminArea } from "@/lib/role-utils";
import { PollCard } from "@/components/poll-card";
import type { Poll } from "@/types";

export default function UmfragenPage() {
  const { status } = useProtectedPage();
  const { data: session } = useSession();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const canManage = canManageAdminArea(session?.user);

  const fetchPolls = useCallback(async (signal?: AbortSignal) => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const after = cutoff.toISOString();
      const responses = await Promise.all([
        fetch("/api/polls?status=LIVE&limit=50", { signal }),
        fetch(`/api/polls?status=CLOSED&after=${encodeURIComponent(after)}&limit=50`, { signal }),
      ]);
      const payloads = await Promise.all(responses.map((response) => response.json()));
      const failed = responses.findIndex((response) => !response.ok);
      if (failed !== -1) {
        throw new Error(payloads[failed].error || "Fehler beim Laden");
      }
      setPolls(payloads.flatMap((payload) => payload.polls));
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
    void fetchPolls(controller.signal);
    return () => controller.abort();
  }, [status, fetchPolls]);

  const openPolls = useMemo(() => polls.filter((p) => p.status === "LIVE"), [polls]);
  const closedPolls = useMemo(() => polls.filter((p) => p.status === "CLOSED"), [polls]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <main className="flex-1 bg-gray-50">
      <PageHeader title="Umfragen" subtitle="Aktuelle und kürzlich abgeschlossene Umfragen" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <AlertBox type="error" message={error} className="mb-4" />

        {canManage && (
          <div className="mb-6 sm:mb-8">
            <Link href="/admin/umfragen" className="btn-primary text-base font-semibold">
              Umfragen verwalten
            </Link>
          </div>
        )}

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Offene Umfragen</h2>
          {openPolls.length === 0 ? (
            <div className="card empty-state mb-8">
              <p className="text-gray-500 text-lg font-medium">Keine offenen Umfragen</p>
              <p className="text-gray-400 text-sm mt-1">Neue Umfragen werden hier angezeigt</p>
            </div>
          ) : (
            <div className="space-y-4 mb-8">
              {openPolls.map((poll) => (
                <PollCard key={poll.id} poll={poll} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Geschlossene Umfragen</h2>
          {closedPolls.length === 0 ? (
            <div className="card empty-state mb-8">
              <p className="text-gray-500 text-lg font-medium">Keine geschlossenen Umfragen</p>
            </div>
          ) : (
            <div className="space-y-4 mb-8">
              {closedPolls.map((poll) => (
                <PollCard key={poll.id} poll={poll} />
              ))}
            </div>
          )}
        </section>

        <div className="text-center">
          <Link href="/umfragen/archiv" className="link-primary text-base font-semibold">
            Ältere Umfragen anzeigen →
          </Link>
        </div>
      </div>
    </main>
  );
}
