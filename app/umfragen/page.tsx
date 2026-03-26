"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getPollTypeLabel } from "@/lib/poll-labels";
import { formatDate } from "@/lib/date-utils";
import { LoadingScreen } from "@/components/loading-screen";
import { PageHeader } from "@/components/page-header";
import { useProtectedPage } from "@/lib/use-protected-page";
import { AlertBox } from "@/components/alert-box";
import { isAdmin } from "@/lib/role-utils";

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

function PollCard({ poll }: { poll: Poll }) {
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
          <span className="px-2 py-0.5 text-sm font-medium rounded bg-brand-blue-50 text-brand-blue-800">
            {getPollTypeLabel(poll.type)}
          </span>
          {poll.multipleChoice && (
            <span className="px-2 py-0.5 text-sm font-medium rounded bg-purple-50 text-purple-800">
              Mehrfachauswahl
            </span>
          )}
          {poll.status === "CLOSED" ? (
            <span className="px-2 py-0.5 text-sm font-medium rounded bg-red-100 text-red-800">
              Geschlossen
            </span>
          ) : poll.userVoteOptionIds.length > 0 ? (
            <span className="px-2 py-0.5 text-sm font-medium rounded bg-green-100 text-green-800">
              Abgestimmt
            </span>
          ) : (
            <span className="px-2 py-0.5 text-sm font-medium rounded bg-amber-100 text-amber-800">
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
  );
}

export default function UmfragenPage() {
  const { status } = useProtectedPage();
  const { data: session } = useSession();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const canManage = isAdmin(session?.user);

  const fetchPolls = useCallback(async (signal?: AbortSignal) => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const after = cutoff.toISOString();
      const response = await fetch(
        `/api/polls?status=LIVE,CLOSED&after=${encodeURIComponent(after)}&limit=50`,
        { signal },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Laden");
      }
      const data = await response.json();
      setPolls(data.polls);
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
